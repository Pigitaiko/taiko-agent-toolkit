// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title AgentRegistry — Onchain identity and reputation for AI agents on Taiko
/// @notice Inspired by ERC-8004 for agent identity. Agents register with metadata,
///         and their reputation is tracked through success/failure reports.
contract AgentRegistry {
    struct Agent {
        address owner;
        string metadata; // JSON string with name, description, capabilities, etc.
        uint256 reputation;
        uint256 successCount;
        uint256 failureCount;
        uint256 registeredAt;
        bool active;
    }

    mapping(bytes32 => Agent) public agents;
    mapping(address => bytes32[]) public ownerAgents;

    event AgentRegistered(bytes32 indexed agentId, address indexed owner, string metadata);
    event AgentUpdated(bytes32 indexed agentId, string metadata);
    event AgentDeactivated(bytes32 indexed agentId);
    event ReputationUpdated(bytes32 indexed agentId, uint256 newReputation, bool success);

    error AgentAlreadyExists();
    error AgentNotFound();
    error NotAgentOwner();
    error AgentInactive();

    modifier onlyAgentOwner(bytes32 agentId) {
        if (agents[agentId].owner != msg.sender) revert NotAgentOwner();
        _;
    }

    modifier agentExists(bytes32 agentId) {
        if (agents[agentId].registeredAt == 0) revert AgentNotFound();
        _;
    }

    modifier agentActive(bytes32 agentId) {
        if (!agents[agentId].active) revert AgentInactive();
        _;
    }

    /// @notice Register a new agent
    /// @param agentId Unique identifier for the agent
    /// @param metadata JSON metadata string
    /// @param owner Address that controls this agent
    function registerAgent(bytes32 agentId, string calldata metadata, address owner) external {
        if (agents[agentId].registeredAt != 0) revert AgentAlreadyExists();

        agents[agentId] = Agent({
            owner: owner,
            metadata: metadata,
            reputation: 100, // Start with base reputation
            successCount: 0,
            failureCount: 0,
            registeredAt: block.timestamp,
            active: true
        });

        ownerAgents[owner].push(agentId);

        emit AgentRegistered(agentId, owner, metadata);
    }

    /// @notice Update agent metadata
    function updateMetadata(bytes32 agentId, string calldata metadata)
        external
        agentExists(agentId)
        onlyAgentOwner(agentId)
    {
        agents[agentId].metadata = metadata;
        emit AgentUpdated(agentId, metadata);
    }

    /// @notice Deactivate an agent
    function deactivateAgent(bytes32 agentId)
        external
        agentExists(agentId)
        onlyAgentOwner(agentId)
    {
        agents[agentId].active = false;
        emit AgentDeactivated(agentId);
    }

    /// @notice Report a successful agent action (increases reputation)
    function reportSuccess(bytes32 agentId)
        external
        agentExists(agentId)
        agentActive(agentId)
    {
        Agent storage agent = agents[agentId];
        agent.successCount++;
        // Reputation increases logarithmically
        agent.reputation = 100 + (agent.successCount * 10) - (agent.failureCount * 20);
        if (agent.reputation > 1000) agent.reputation = 1000;
        emit ReputationUpdated(agentId, agent.reputation, true);
    }

    /// @notice Report a failed agent action (decreases reputation)
    function reportFailure(bytes32 agentId)
        external
        agentExists(agentId)
        agentActive(agentId)
    {
        Agent storage agent = agents[agentId];
        agent.failureCount++;
        uint256 penalty = agent.failureCount * 20;
        uint256 bonus = agent.successCount * 10;
        if (100 + bonus > penalty) {
            agent.reputation = 100 + bonus - penalty;
        } else {
            agent.reputation = 0;
        }
        emit ReputationUpdated(agentId, agent.reputation, false);
    }

    /// @notice Get agent details
    function getAgent(bytes32 agentId)
        external
        view
        returns (address owner, string memory metadata, uint256 reputation, uint256 registeredAt)
    {
        Agent storage agent = agents[agentId];
        return (agent.owner, agent.metadata, agent.reputation, agent.registeredAt);
    }

    /// @notice Get full agent details including counts
    function getAgentFull(bytes32 agentId)
        external
        view
        returns (
            address owner,
            string memory metadata,
            uint256 reputation,
            uint256 successCount,
            uint256 failureCount,
            uint256 registeredAt,
            bool active
        )
    {
        Agent storage agent = agents[agentId];
        return (
            agent.owner,
            agent.metadata,
            agent.reputation,
            agent.successCount,
            agent.failureCount,
            agent.registeredAt,
            agent.active
        );
    }

    /// @notice Get all agent IDs for an owner
    function getAgentsByOwner(address owner) external view returns (bytes32[] memory) {
        return ownerAgents[owner];
    }
}
