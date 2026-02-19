local MySQL = MySQL
local DBReady = false

local function EnsureDatabase()
    if DBReady then return end

    MySQL.query([[
        CREATE TABLE IF NOT EXISTS `rc_interaction_groups` (
          `id` int(11) NOT NULL AUTO_INCREMENT,
          `name` varchar(50) NOT NULL,
          `created_at` timestamp NULL DEFAULT current_timestamp(),
          PRIMARY KEY (`id`),
          UNIQUE KEY `name` (`name`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ]], {}, function()
        MySQL.query([[
            CREATE TABLE IF NOT EXISTS `rc_interactions` (
              `id` int(11) NOT NULL AUTO_INCREMENT,
              `uuid` varchar(50) NOT NULL,
              `name` varchar(50) DEFAULT NULL,
              `group_id` int(11) DEFAULT NULL,
              `data` longtext DEFAULT NULL,
              `created_at` timestamp NULL DEFAULT current_timestamp(),
              `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
              PRIMARY KEY (`id`),
              UNIQUE KEY `uuid` (`uuid`),
              KEY `fk_group` (`group_id`),
              CONSTRAINT `fk_group` FOREIGN KEY (`group_id`) REFERENCES `rc_interaction_groups` (`id`) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ]], {}, function()
            MySQL.insert('INSERT IGNORE INTO rc_interaction_groups (name) VALUES (?)', { 'General' }, function()
                DBReady = true
                print('^2[RC-Interactions]^7 Database ready')
                TriggerEvent('rc-interactions:server:syncAllClients')
                -- Bootstrap the server-side cache
                TriggerEvent('rc-interactions:internal:refreshCache')
            end)
        end)
    end)
end

AddEventHandler('onResourceStart', function(resName)
    if resName ~= GetCurrentResourceName() then return end
    EnsureDatabase()
end)

RegisterNetEvent('rc-interactions:server:checkEditorPermissions', function()
    local src = source
    EnsureDatabase()
    if Bridge.HasGroup(src, Config.EditorGroup) then
        TriggerClientEvent('rc-interactions:client:openEditor', src)
    else
        Bridge.Notify('You do not have permission to access the editor.', 'error', 5000, src)
    end
end)

RegisterNetEvent('rc-interactions:server:saveProject', function(projectData)
    local src = source
    EnsureDatabase()
    if not Bridge.HasGroup(src, Config.EditorGroup) then return end

    local uuid = projectData.id
    local name = projectData.name
    local groupName = projectData.group or 'General'
    local data = json.encode(projectData.data)

    -- First ensure group exists or get its ID
    MySQL.scalar('SELECT id FROM rc_interaction_groups WHERE name = ?', {groupName}, function(groupId)
        if not groupId then
            MySQL.insert('INSERT INTO rc_interaction_groups (name) VALUES (?)', {groupName}, function(newGroupId)
                if newGroupId then
                    SaveInteraction(src, uuid, name, newGroupId, data)
                else
                    TriggerClientEvent('rc-interactions:client:projectSaved', src, false, 'Group creation error')
                end
            end)
        else
            SaveInteraction(src, uuid, name, groupId, data)
        end
    end)
end)

function SaveInteraction(src, uuid, name, groupId, data)
    MySQL.insert('INSERT INTO rc_interactions (uuid, name, group_id, data) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = ?, group_id = ?, data = ?',
        {uuid, name, groupId, data, name, groupId, data}, function(id)
            if id then
                TriggerClientEvent('rc-interactions:client:projectSaved', src, true)
                TriggerEvent('rc-interactions:server:syncAllClients')
            else
                TriggerClientEvent('rc-interactions:client:projectSaved', src, false, 'Database error')
            end
    end)
end

RegisterNetEvent('rc-interactions:server:syncAllClients', function()
    EnsureDatabase()
    if not DBReady then return end
    MySQL.query('SELECT i.*, g.name as group_name FROM rc_interactions i LEFT JOIN rc_interaction_groups g ON i.group_id = g.id', {}, function(result)
        local interactions = {}
        if result then
            for _, row in ipairs(result) do
                table.insert(interactions, {
                    id = row.uuid,
                    name = row.name,
                    group = row.group_name or 'General',
                    data = json.decode(row.data)
                })
            end
        end
        TriggerClientEvent('rc-interactions:client:syncInteractions', -1, interactions)
        -- Also refresh the server-side cache for secure node processing
        TriggerEvent('rc-interactions:internal:refreshCache')
    end)
end)

RegisterNetEvent('rc-interactions:server:requestSync', function()
    local src = source
    EnsureDatabase()
    if not DBReady then return end
    MySQL.query('SELECT i.*, g.name as group_name FROM rc_interactions i LEFT JOIN rc_interaction_groups g ON i.group_id = g.id', {}, function(result)
        local interactions = {}
        if result then
            for _, row in ipairs(result) do
                table.insert(interactions, {
                    id = row.uuid,
                    name = row.name,
                    group = row.group_name or 'General',
                    data = json.decode(row.data)
                })
            end
        end
        TriggerClientEvent('rc-interactions:client:syncInteractions', src, interactions)
    end)
end)

RegisterNetEvent('rc-interactions:server:loadProjects', function()
    local src = source
    EnsureDatabase()
    if not DBReady then return end
    if not Bridge.HasGroup(src, Config.EditorGroup) then return end

    MySQL.query('SELECT i.*, g.name as group_name FROM rc_interactions i LEFT JOIN rc_interaction_groups g ON i.group_id = g.id', {}, function(result)
        local projects = {}
        if result then
            for _, row in ipairs(result) do
                table.insert(projects, {
                    id = row.uuid,
                    name = row.name,
                    group = row.group_name or 'General',
                    createdAt = row.created_at,
                    updatedAt = row.updated_at,
                    data = json.decode(row.data)
                })
            end
        end
        TriggerClientEvent('rc-interactions:client:receiveProjects', src, projects)
    end)
end)

RegisterNetEvent('rc-interactions:server:deleteProject', function(uuid)
    local src = source
    if not Bridge.HasGroup(src, Config.EditorGroup) then return end

    MySQL.query('DELETE FROM rc_interactions WHERE uuid = ?', {uuid}, function(affectedRows)
        if affectedRows > 0 then
            Bridge.Notify('Project deleted.', 'success', 5000, src)
        else
            Bridge.Notify('Project not found.', 'error', 5000, src)
        end
    end)
end)

-- ============================================================
-- PHASE 2 – SECURE ECONOMY HANDLERS
-- ============================================================
-- SECURITY MODEL:
--   The client NEVER tells the server what to give/remove.
--   Instead it sends (projectId, nodeId) and the server resolves
--   the real values from its own cached copy of the project data.
--   This makes it impossible to spoof amounts or item names.
-- ============================================================

-- Active interaction sessions per player
local ActiveSessions = {} -- [serverId] = { projectId = string, startedAt = number }
-- Per-player processed-node set – prevents replaying the same node
local ProcessedNodes = {} -- [serverId] = { ["projectId:nodeId"] = true }
-- Economy cooldown per player
local Cooldowns = {}       -- [serverId] = os.time()

local ECONOMY_COOLDOWN = 1   -- min seconds between economy actions per player
local MAX_ITEM_COUNT   = 100 -- hard cap per single node
local MAX_MONEY_AMOUNT = 1000000
local VALID_MONEY_TYPES = { cash = true, bank = true }

-- Server-side interactions cache (kept in sync with DB)
local CachedInteractions = {} -- same shape as Interactions on client

-- Rebuild the cache from DB
local function RefreshCachedInteractions()
    if not DBReady then return end
    MySQL.query(
        'SELECT i.*, g.name as group_name FROM rc_interactions i LEFT JOIN rc_interaction_groups g ON i.group_id = g.id',
        {},
        function(result)
            local list = {}
            if result then
                for _, row in ipairs(result) do
                    list[#list + 1] = {
                        id   = row.uuid,
                        name = row.name,
                        group = row.group_name or 'General',
                        data = json.decode(row.data)
                    }
                end
            end
            CachedInteractions = list
            if Config.Debug then
                print('[RC-Interactions] Cached ' .. #list .. ' interactions on server')
            end
        end
    )
end

-- Refresh cache every time interactions are synced to clients
AddEventHandler('rc-interactions:internal:refreshCache', function()
    RefreshCachedInteractions()
end)

-- -------- helpers --------

local function FindNodeInProject(projectId, nodeId)
    for _, project in ipairs(CachedInteractions) do
        if project.id == projectId and project.data and project.data.nodes then
            for _, node in ipairs(project.data.nodes) do
                if node.id == nodeId then
                    return node, project
                end
            end
        end
    end
    return nil, nil
end

local function ValidateSession(src, projectId)
    local s = ActiveSessions[src]
    if not s then
        if Config.Debug then
            print('^1[RC-Interactions] SECURITY: player ' .. src .. ' has no active session^7')
        end
        return false
    end
    if s.projectId ~= projectId then
        if Config.Debug then
            print('^1[RC-Interactions] SECURITY: player ' .. src .. ' session mismatch (have=' .. s.projectId .. ' got=' .. tostring(projectId) .. ')^7')
        end
        return false
    end
    return true
end

local function CheckCooldown(src)
    local last = Cooldowns[src]
    if last and (os.time() - last) < ECONOMY_COOLDOWN then
        if Config.Debug then
            print('^1[RC-Interactions] SECURITY: player ' .. src .. ' rate-limited^7')
        end
        return false
    end
    Cooldowns[src] = os.time()
    return true
end

local function IsNodeAlreadyProcessed(src, projectId, nodeId)
    local key = projectId .. ':' .. nodeId
    if ProcessedNodes[src] and ProcessedNodes[src][key] then
        if Config.Debug then
            print('^1[RC-Interactions] SECURITY: player ' .. src .. ' replayed node ' .. key .. '^7')
        end
        return true
    end
    if not ProcessedNodes[src] then ProcessedNodes[src] = {} end
    ProcessedNodes[src][key] = true
    return false
end

-- -------- session lifecycle --------

RegisterNetEvent('rc-interactions:server:startSession', function(projectId)
    local src = source
    if type(projectId) ~= 'string' or #projectId > 100 then return end
    ActiveSessions[src] = { projectId = projectId, startedAt = os.time() }
    ProcessedNodes[src] = {} -- reset processed set for new session
    if Config.Debug then
        print('[RC-Interactions] Session started: player=' .. src .. ' project=' .. projectId)
    end
end)

RegisterNetEvent('rc-interactions:server:endSession', function()
    local src = source
    ActiveSessions[src] = nil
    ProcessedNodes[src] = nil
    if Config.Debug then
        print('[RC-Interactions] Session ended: player=' .. src)
    end
end)

AddEventHandler('playerDropped', function()
    local src = source
    ActiveSessions[src]  = nil
    ProcessedNodes[src]  = nil
    Cooldowns[src]       = nil
end)

-- -------- single secure entry-point for economy nodes --------

RegisterNetEvent('rc-interactions:server:processNode', function(projectId, nodeId)
    local src = source

    -- 1. Basic type/length checks
    if type(projectId) ~= 'string' or type(nodeId) ~= 'string' then return end
    if #projectId > 100 or #nodeId > 100 then return end

    -- 2. Session validation
    if not ValidateSession(src, projectId) then return end

    -- 3. Replay protection – same node in same session = reject
    if IsNodeAlreadyProcessed(src, projectId, nodeId) then return end

    -- 4. Cooldown
    if not CheckCooldown(src) then return end

    -- 5. Resolve node from SERVER-SIDE data (never trust the client)
    local node, project = FindNodeInProject(projectId, nodeId)
    if not node then
        if Config.Debug then
            print('^1[RC-Interactions] SECURITY: node not found – project=' .. projectId .. ' node=' .. nodeId .. ' player=' .. src .. '^7')
        end
        return
    end

    -- 6. Process only economy-related node types
    if node.type == 'GIVE_ITEM' then
        local itemName  = tostring(node.data.itemName  or ''):gsub('[^%w_%-]', '')
        local itemCount = math.floor(math.max(1, math.min(tonumber(node.data.itemCount) or 1, MAX_ITEM_COUNT)))
        if itemName ~= '' then
            Bridge.AddItem(src, itemName, itemCount)
            if Config.Debug then
                print('[RC-Interactions] Server: Give ' .. itemCount .. 'x ' .. itemName .. ' to player ' .. src)
            end
        end

    elseif node.type == 'REMOVE_ITEM' then
        local itemName  = tostring(node.data.itemName  or ''):gsub('[^%w_%-]', '')
        local itemCount = math.floor(math.max(1, math.min(tonumber(node.data.itemCount) or 1, MAX_ITEM_COUNT)))
        if itemName ~= '' then
            Bridge.RemoveItem(src, itemName, itemCount)
            if Config.Debug then
                print('[RC-Interactions] Server: Remove ' .. itemCount .. 'x ' .. itemName .. ' from player ' .. src)
            end
        end

    elseif node.type == 'GIVE_MONEY' then
        local moneyType   = VALID_MONEY_TYPES[node.data.moneyType] and node.data.moneyType or 'cash'
        local moneyAmount = math.floor(math.max(0, math.min(tonumber(node.data.moneyAmount) or 0, MAX_MONEY_AMOUNT)))
        if moneyAmount > 0 then
            Bridge.AddMoney(src, moneyType, moneyAmount)
            if Config.Debug then
                print('[RC-Interactions] Server: Give $' .. moneyAmount .. ' (' .. moneyType .. ') to player ' .. src)
            end
        end

    elseif node.type == 'REMOVE_MONEY' then
        local moneyType   = VALID_MONEY_TYPES[node.data.moneyType] and node.data.moneyType or 'cash'
        local moneyAmount = math.floor(math.max(0, math.min(tonumber(node.data.moneyAmount) or 0, MAX_MONEY_AMOUNT)))
        if moneyAmount > 0 then
            Bridge.RemoveMoney(src, moneyType, moneyAmount)
            if Config.Debug then
                print('[RC-Interactions] Server: Remove $' .. moneyAmount .. ' (' .. moneyType .. ') from player ' .. src)
            end
        end

    else
        if Config.Debug then
            print('^1[RC-Interactions] SECURITY: player ' .. src .. ' tried to process non-economy node type: ' .. tostring(node.type) .. '^7')
        end
    end
end)
