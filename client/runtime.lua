local Interactions = {}
local SpawnedEntities = {}
local ActiveZones = {}
local InteractionMemory = {}
local cam = nil
local talkLoopToken = 0
local activeTalkProjectId = nil
local activeTalkPed = nil

local SPEECH_PARAMS = "SPEECH_PARAMS_FORCE_NORMAL_CLEAR"
local SPEECH_LINES = {
    "GENERIC_HI",
    "GENERIC_HOWS_IT_GOING",
    "GENERIC_THANKS",
    "GENERIC_YES",
    "GENERIC_NO",
}

-- Initialize
CreateThread(function()
    TriggerServerEvent('rc-interactions:server:requestSync')
end)

RegisterNetEvent('rc-interactions:client:syncInteractions', function(data)
    Interactions = data
    RefreshInteractions()
end)

local function CreateInteractionCam(ped)
    if DoesCamExist(cam) then DestroyCam(cam, true) end
    
    -- Calculate position in front of ped
    local coords = GetEntityCoords(ped)
    local forward = GetEntityForwardVector(ped)
    local camPos = coords + (forward * 0.8) + vector3(0.0, 0.0, 0.65) -- 0.8m front, 0.65m up (face level approx)
    
    cam = CreateCam("DEFAULT_SCRIPTED_CAMERA", true)
    SetCamCoord(cam, camPos.x, camPos.y, camPos.z)
    PointCamAtPedBone(cam, ped, 31086, 0.0, 0.0, 0.0, true) -- Head bone
    SetCamActive(cam, true)
    RenderScriptCams(true, true, 1000, true, true)
end

local function DestroyInteractionCam()
    if DoesCamExist(cam) then
        RenderScriptCams(false, true, 1000, true, true)
        DestroyCam(cam, false)
        cam = nil
    end
end

local function PlayTalkAnim(ped)
    local dict = "missfbi3_party_d"
    local anim = "stand_talk_loop_a_male"
    
    RequestAnimDict(dict)
    while not HasAnimDictLoaded(dict) do Wait(10) end
    
    -- Flag 49 = Loop (1) + Upper Body (16) + Allow Rotation (32) = 49? 
    -- Flag 51 = Loop (1) + Upper Body (16) + Allow Rotation (32) + Override Physics (2)? No.
    -- Standard flags: 
    -- 1 = Loop
    -- 16 = Upper body only
    -- 48 = 16 + 32 (Upper body + Allow rotation)
    -- 49 = 1 + 16 + 32 (Loop + Upper body + Allow rotation)
    ClearPedTasks(ped)
    TaskPlayAnim(ped, dict, anim, 8.0, -8.0, -1, 1, 0, false, false, false)
end

local function StopNpcTalkLoop()
    talkLoopToken = talkLoopToken + 1

    if activeTalkPed and DoesEntityExist(activeTalkPed) then
        -- Stop mouth/voice immediately if possible
        StopCurrentPlayingSpeech(activeTalkPed)
        ClearPedTasks(activeTalkPed)
    end

    activeTalkProjectId = nil
    activeTalkPed = nil
end

local function EnsureNpcTalkLoop(projectId, ped)
    if Config and Config.EnableNpcSpeech == false then return end
    if not projectId or not DoesEntityExist(ped) then return end

    -- Avoid spawning multiple loops for the same active interaction.
    if activeTalkProjectId == projectId and activeTalkPed == ped then
        return
    end

    talkLoopToken = talkLoopToken + 1
    local myToken = talkLoopToken
    activeTalkProjectId = projectId
    activeTalkPed = ped

    CreateThread(function()
        while talkLoopToken == myToken do
            if not DoesEntityExist(ped) then
                break
            end

            -- Trigger short ambient speech lines; this usually drives lipsync automatically.
            if not IsAnySpeechPlaying(ped) then
                local line = SPEECH_LINES[math.random(1, #SPEECH_LINES)]
                PlayAmbientSpeech1(ped, line, SPEECH_PARAMS)
            end

            Wait(2200 + math.random(300, 900))
        end
    end)
end

function RefreshInteractions()
    -- Cleanup existing
    for _, entity in pairs(SpawnedEntities) do
        if DoesEntityExist(entity) then DeleteEntity(entity) end
    end
    SpawnedEntities = {}
    
    -- In a real implementation, we would remove zones/targets here too
    
    -- Create new
    for _, project in ipairs(Interactions) do
        SetupInteraction(project)
    end
end

function SetupInteraction(project)
    if not project.data or not project.data.nodes then return end
    
    local startNode = nil
    for _, node in ipairs(project.data.nodes) do
        if node.type == 'START' then
            startNode = node
            break
        end
    end
    
    if not startNode then return end
    
    -- Check if start node has coordinates (Assuming data.coords exists)
    -- If not, we can't spawn anything in the world
    if not startNode.data.coords then 
        -- print('Interaction ' .. project.name .. ' has no start coords')
        return 
    end
    
    local coords = startNode.data.coords
    local model = startNode.data.model or 'a_m_y_business_01'
    
    -- Spawn NPC logic (simplified)
    local hash = GetHashKey(model)
    RequestModel(hash)
    while not HasModelLoaded(hash) do Wait(10) end
    
    local ped = CreatePed(4, hash, coords.x, coords.y, coords.z - 1.0, coords.w or 0.0, false, true)
    FreezeEntityPosition(ped, true)
    SetEntityInvincible(ped, true)
    SetBlockingOfNonTemporaryEvents(ped, true)
    
    SpawnedEntities[project.id] = ped
    
    -- Setup Interaction (Target or TextUI)
    if Config.UseTarget then
        -- Use qb-target or ox_target
        if GetResourceState('qb-target') == 'started' then
            exports['qb-target']:AddTargetEntity(ped, {
                options = {
                    {
                        type = "client",
                        action = function()
                            StartInteraction(project)
                        end,
                        icon = "fas fa-comment",
                        label = "Talk",
                    },
                },
                distance = 2.5,
            })
        elseif GetResourceState('ox_target') == 'started' then
             exports.ox_target:addLocalEntity(ped, {
                {
                    name = 'interaction_' .. project.id,
                    icon = 'fas fa-comment',
                    label = 'Talk',
                    onSelect = function()
                        StartInteraction(project)
                    end
                }
            })
        end
    else
        -- Distance check loop (simplified, better to use a point library)
        -- For now, we skip this to keep it clean.
    end
end

function StartInteraction(project)
    -- Find Start Node
    local startNode = nil
    for _, node in ipairs(project.data.nodes) do
        if node.type == 'START' then startNode = node break end
    end
    
    if startNode then
        -- Notify server that this player is starting a session (security)
        TriggerServerEvent('rc-interactions:server:startSession', project.id)

        -- Setup Camera and Ped
        local ped = SpawnedEntities[project.id]
        if DoesEntityExist(ped) then
            CreateInteractionCam(ped)
        end

        ProcessNode(project, startNode)
    end
end

function ProcessNode(project, node)
    if not node then return end
    
    if node.type == 'START' then
        -- Find next node
        local nextNode = FindNextNode(project, node.id, 'main')
        ProcessNode(project, nextNode)
        
    elseif node.type == 'DIALOGUE' then
        -- Play per-node custom animation if configured, otherwise use default talk anim
        local ped = SpawnedEntities[project.id]
        if DoesEntityExist(ped) then
            if node.data.animDict and node.data.animName and node.data.animDict ~= '' and node.data.animName ~= '' then
                -- Custom animation for this dialogue node (user suggestion: per-node NPC anim)
                local dict = node.data.animDict
                local anim = node.data.animName
                RequestAnimDict(dict)
                local timeout = 0
                while not HasAnimDictLoaded(dict) and timeout < 500 do Wait(10) timeout = timeout + 10 end
                if HasAnimDictLoaded(dict) then
                    ClearPedTasks(ped)
                    TaskPlayAnim(ped, dict, anim, 8.0, -8.0, -1, 1, 0, false, false, false)
                end
            else
                PlayTalkAnim(ped)
            end
            EnsureNpcTalkLoop(project.id, ped)
        end

        -- Show Dialogue UI
        SetNuiFocus(true, true)
        SendNUIMessage({
            action = 'showDialogue',
            data = {
                text = node.data.text,
                name = node.data.npcName,
                choices = node.data.choices,
                nodeId = node.id,
                projectId = project.id
            }
        })
        
    elseif node.type == 'END' then
        -- Stop Anim
        StopNpcTalkLoop()
        
        -- Destroy Cam
        DestroyInteractionCam()

        -- Clear interaction memory
        InteractionMemory = {}

        -- End server session (security)
        TriggerServerEvent('rc-interactions:server:endSession')

        -- Close UI
        SetNuiFocus(false, false)
        SendNUIMessage({ action = 'closeDialogue' })
        
        -- Trigger event for external integrations
        TriggerEvent('rc-interactions:dialogueEnded', {
            projectId = project.id,
            cancelled = false
        })
        if Config.Debug then
            print('[RC-Interactions] Dialogue ended - Project: ' .. project.id .. ' | Cancelled: false')
        end
        
    elseif node.type == 'CONDITION' then
        local result = CheckCondition(node.data)
        local portId = result and 'true' or 'false'
        local nextNode = FindNextNode(project, node.id, portId)
        ProcessNode(project, nextNode)

    elseif node.type == 'SET_VARIABLE' then
        -- Store variable in memory
        if node.data.variableName then
            InteractionMemory[node.data.variableName] = node.data.variableValue or ''
            if Config.Debug then
                print('[RC-Interactions] Set variable: ' .. node.data.variableName .. ' = ' .. tostring(node.data.variableValue))
            end
        end
        -- Continue to next node
        local nextNode = FindNextNode(project, node.id, 'main')
        ProcessNode(project, nextNode)

    elseif node.type == 'EVENT' then
        -- Trigger Event
        if node.data.eventName then
            if node.data.isServer then
                TriggerServerEvent(node.data.eventName, node.data.eventPayload)
            else
                TriggerEvent(node.data.eventName, node.data.eventPayload)
            end
        end
        -- Continue
        local nextNode = FindNextNode(project, node.id, 'main')
        ProcessNode(project, nextNode)

    elseif node.type == 'GIVE_ITEM' then
        -- Secure: send only projectId + nodeId; server resolves item/count from its cache
        TriggerServerEvent('rc-interactions:server:processNode', project.id, node.id)
        if Config.Debug then
            print('[RC-Interactions] Give item (secure): project=' .. project.id .. ' node=' .. node.id)
        end
        local nextNode = FindNextNode(project, node.id, 'main')
        ProcessNode(project, nextNode)

    elseif node.type == 'REMOVE_ITEM' then
        -- Secure: send only projectId + nodeId; server resolves item/count from its cache
        TriggerServerEvent('rc-interactions:server:processNode', project.id, node.id)
        if Config.Debug then
            print('[RC-Interactions] Remove item (secure): project=' .. project.id .. ' node=' .. node.id)
        end
        local nextNode = FindNextNode(project, node.id, 'main')
        ProcessNode(project, nextNode)

    elseif node.type == 'GIVE_MONEY' then
        -- Secure: send only projectId + nodeId; server resolves type/amount from its cache
        TriggerServerEvent('rc-interactions:server:processNode', project.id, node.id)
        if Config.Debug then
            print('[RC-Interactions] Give money (secure): project=' .. project.id .. ' node=' .. node.id)
        end
        local nextNode = FindNextNode(project, node.id, 'main')
        ProcessNode(project, nextNode)

    elseif node.type == 'REMOVE_MONEY' then
        -- Secure: send only projectId + nodeId; server resolves type/amount from its cache
        TriggerServerEvent('rc-interactions:server:processNode', project.id, node.id)
        if Config.Debug then
            print('[RC-Interactions] Remove money (secure): project=' .. project.id .. ' node=' .. node.id)
        end
        local nextNode = FindNextNode(project, node.id, 'main')
        ProcessNode(project, nextNode)

    elseif node.type == 'ANIMATION' then
        -- Play animation on NPC or player
        local dict = node.data.animDict or ''
        local anim = node.data.animName or ''
        local target = node.data.animTarget or 'npc'
        local duration = tonumber(node.data.animDuration) or 3000

        if dict ~= '' and anim ~= '' then
            RequestAnimDict(dict)
            local timeout = 0
            while not HasAnimDictLoaded(dict) and timeout < 500 do Wait(10) timeout = timeout + 10 end

            if HasAnimDictLoaded(dict) then
                local targetPed
                if target == 'player' then
                    targetPed = PlayerPedId()
                else
                    targetPed = SpawnedEntities[project.id]
                end

                if targetPed and DoesEntityExist(targetPed) then
                    ClearPedTasks(targetPed)
                    TaskPlayAnim(targetPed, dict, anim, 8.0, -8.0, duration, 0, 0, false, false, false)
                    if Config.Debug then
                        print('[RC-Interactions] Animation: ' .. target .. ' plays ' .. dict .. '/' .. anim .. ' for ' .. duration .. 'ms')
                    end
                end
            end
        end

        -- Wait for the animation duration before continuing
        Wait(duration)
        local nextNode = FindNextNode(project, node.id, 'main')
        ProcessNode(project, nextNode)

    elseif node.type == 'WAIT' then
        -- Timed pause before continuing
        local duration = tonumber(node.data.waitDuration) or 2000
        if Config.Debug then
            print('[RC-Interactions] Wait: ' .. duration .. 'ms')
        end
        Wait(duration)
        local nextNode = FindNextNode(project, node.id, 'main')
        ProcessNode(project, nextNode)

    elseif node.type == 'RANDOM' then
        -- Random branching with weighted outputs
        local outputs = node.data.randomOutputs or {}
        if #outputs > 0 then
            local totalWeight = 0
            for _, output in ipairs(outputs) do
                totalWeight = totalWeight + (tonumber(output.weight) or 0)
            end
            
            local roll = math.random() * totalWeight
            local selectedId = outputs[1].id
            for _, output in ipairs(outputs) do
                roll = roll - (tonumber(output.weight) or 0)
                if roll <= 0 then
                    selectedId = output.id
                    break
                end
            end

            if Config.Debug then
                print('[RC-Interactions] Random: selected output ' .. tostring(selectedId))
            end

            local nextNode = FindNextNode(project, node.id, selectedId)
            ProcessNode(project, nextNode)
        else
            -- No outputs configured, try main
            local nextNode = FindNextNode(project, node.id, 'main')
            ProcessNode(project, nextNode)
        end

    elseif node.type == 'TELEPORT' then
        -- Teleport the player to specific coordinates
        local tc = node.data.teleportCoords
        if tc and tc.x and tc.y and tc.z then
            local heading = tc.w or 0.0
            SetEntityCoords(PlayerPedId(), tc.x + 0.0, tc.y + 0.0, tc.z + 0.0, false, false, false, true)
            SetEntityHeading(PlayerPedId(), heading + 0.0)
            if Config.Debug then
                print('[RC-Interactions] Teleport: ' .. tc.x .. ', ' .. tc.y .. ', ' .. tc.z)
            end
        end
        local nextNode = FindNextNode(project, node.id, 'main')
        ProcessNode(project, nextNode)

    elseif node.type == 'NPC_CHANGE' then
        -- Change the NPC model mid-conversation
        local newModel = node.data.newModel or 'a_m_y_business_01'
        local ped = SpawnedEntities[project.id]
        
        if ped and DoesEntityExist(ped) then
            local coords = GetEntityCoords(ped)
            local heading = GetEntityHeading(ped)
            
            -- Delete old ped
            DeleteEntity(ped)
            
            -- Create new ped
            local hash = GetHashKey(newModel)
            RequestModel(hash)
            local timeout = 0
            while not HasModelLoaded(hash) and timeout < 5000 do Wait(10) timeout = timeout + 10 end
            
            if HasModelLoaded(hash) then
                local newPed = CreatePed(4, hash, coords.x, coords.y, coords.z, heading, false, true)
                FreezeEntityPosition(newPed, true)
                SetEntityInvincible(newPed, true)
                SetBlockingOfNonTemporaryEvents(newPed, true)
                SpawnedEntities[project.id] = newPed
                
                -- Apply optional animation
                if node.data.newAnimDict and node.data.newAnimName and node.data.newAnimDict ~= '' and node.data.newAnimName ~= '' then
                    local dict = node.data.newAnimDict
                    local anim = node.data.newAnimName
                    RequestAnimDict(dict)
                    local t2 = 0
                    while not HasAnimDictLoaded(dict) and t2 < 500 do Wait(10) t2 = t2 + 10 end
                    if HasAnimDictLoaded(dict) then
                        TaskPlayAnim(newPed, dict, anim, 8.0, -8.0, -1, 1, 0, false, false, false)
                    end
                end
                
                -- Re-point camera at new ped
                CreateInteractionCam(newPed)
                
                if Config.Debug then
                    print('[RC-Interactions] NPC Change: model=' .. newModel)
                end
            end
        end
        
        local nextNode = FindNextNode(project, node.id, 'main')
        ProcessNode(project, nextNode)

    elseif node.type == 'SOUND' then
        -- Play a sound effect
        local soundName = node.data.soundName or ''
        if soundName ~= '' then
            -- Use GTA native PlaySoundFrontend for known sounds
            PlaySoundFrontend(-1, soundName, "HUD_FRONTEND_DEFAULT_SOUNDSET", true)
            if Config.Debug then
                print('[RC-Interactions] Sound: ' .. soundName .. ' vol=' .. tostring(node.data.soundVolume or 50))
            end
        end
        local nextNode = FindNextNode(project, node.id, 'main')
        ProcessNode(project, nextNode)
    end
end

function CheckCondition(data)
    if not data then return false end
    
    local varType, varName = data.variableName:match("([^:]+):(.+)")
    if not varType then 
        -- Fallback: check InteractionMemory for simple variables (set by SET_VARIABLE nodes)
        local memValue = InteractionMemory[data.variableName] or ''
        local targetValue = data.variableValue or ''
        local op = data.conditionOperator or '=='

        local numA = tonumber(memValue)
        local numB = tonumber(targetValue)
        local isNumeric = numA ~= nil and numB ~= nil

        if op == '==' then return memValue == targetValue
        elseif op == '!=' then return memValue ~= targetValue
        elseif op == '>' then return isNumeric and numA > numB or false
        elseif op == '<' then return isNumeric and numA < numB or false
        elseif op == '>=' then return isNumeric and numA >= numB or false
        elseif op == '<=' then return isNumeric and numA <= numB or false
        end

        return false 
    end

    local currentValue = nil
    local targetValue = tonumber(data.variableValue) or data.variableValue

    if varType == 'item' then
        currentValue = Bridge.HasItem(GetPlayerServerId(PlayerId()), varName, 1) and 1 or 0
        -- HasItem returns boolean, but for comparison we might want numbers if checking count
        -- For now, let's assume HasItem checks existence. 
        -- If we want to check count, we need a Bridge.GetItemCount function.
        -- But Bridge.HasItem(source, item, count) exists.
        -- If the condition is "item:apple > 5", we need to check count.
        -- Current Bridge.HasItem returns boolean.
        -- Let's assume for now we are checking boolean existence or simple count if supported.
        
        -- Actually, let's use the Bridge.HasItem with the target value if it's a number
        if type(targetValue) == 'number' then
            return Bridge.HasItem(GetPlayerServerId(PlayerId()), varName, targetValue)
        else
            return Bridge.HasItem(GetPlayerServerId(PlayerId()), varName, 1)
        end

    elseif varType == 'money' then
        currentValue = Bridge.GetMoney(GetPlayerServerId(PlayerId()), varName)
        local op = data.conditionOperator or '=='
        local numCurrent = tonumber(currentValue) or 0
        local numTarget = tonumber(targetValue) or 0

        if op == '==' then return numCurrent == numTarget
        elseif op == '!=' then return numCurrent ~= numTarget
        elseif op == '>' then return numCurrent > numTarget
        elseif op == '<' then return numCurrent < numTarget
        elseif op == '>=' then return numCurrent >= numTarget
        elseif op == '<=' then return numCurrent <= numTarget
        end
        return false
        
    elseif varType == 'job' then
        return Bridge.HasGroup(GetPlayerServerId(PlayerId()), varName)
    end

    return false
end

function FindNextNode(project, currentNodeId, portId)
    for _, conn in ipairs(project.data.connections) do
        if conn.fromNodeId == currentNodeId and (conn.fromPort == portId or (not portId)) then
            -- Find the target node
            for _, node in ipairs(project.data.nodes) do
                if node.id == conn.toNodeId then
                    return node
                end
            end
        end
    end
    return nil
end

-- Callback from Dialogue UI when a choice is selected
RegisterNUICallback('selectChoice', function(data, cb)
    -- data: { projectId, nodeId, choiceId }
    local project = nil
    for _, p in ipairs(Interactions) do
        if p.id == data.projectId then project = p break end
    end
    
    if project then
        -- Find the connection from this node with this choiceId
        local nextNode = FindNextNode(project, data.nodeId, data.choiceId)
        ProcessNode(project, nextNode)
    end
    cb('ok')
end)

RegisterNUICallback('cancelInteraction', function(data, cb)
    local projectId = data.projectId
    if projectId and SpawnedEntities[projectId] then
        local ped = SpawnedEntities[projectId]
        if DoesEntityExist(ped) then
            ClearPedTasks(ped)
        end
    end

    StopNpcTalkLoop()
    
    DestroyInteractionCam()

    -- Clear interaction memory
    InteractionMemory = {}

    -- End server session (security)
    TriggerServerEvent('rc-interactions:server:endSession')

    SetNuiFocus(false, false)
    SendNUIMessage({ action = 'closeDialogue' })
    
    -- Trigger event for external integrations
    TriggerEvent('rc-interactions:dialogueEnded', {
        projectId = projectId,
        cancelled = true
    })
    if Config.Debug then
        print('[RC-Interactions] Dialogue ended - Project: ' .. tostring(projectId) .. ' | Cancelled: true')
    end
    
    cb('ok')
end)

-- Public API: allow other scripts to start a flow by UUID without the editor
function StartInteractionById(projectId)
    if not projectId then return false end

    local project = nil
    for _, p in ipairs(Interactions) do
        if p.id == projectId then project = p break end
    end

    if not project then
        print(('^1[RC-Interactions]^7 StartInteractionById: project not found: %s'):format(tostring(projectId)))
        return false
    end

    StartInteraction(project)
    return true
end

exports('StartInteractionById', StartInteractionById)

RegisterNetEvent('rc-interactions:client:startInteractionById', function(projectId)
    StartInteractionById(projectId)
end)

-- Test helpers: expose local state for the test harness.
-- These are only used by client/tests.lua when Config.Debug is true.
function _RCI_GetMemory()      return InteractionMemory end
function _RCI_SetMemory(t)     InteractionMemory = t end
function _RCI_GetInteractions() return Interactions end
