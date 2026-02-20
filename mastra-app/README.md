# OCI GenAI MCP Chat - Mastra App

A TypeScript/Next.js chat application powered by Oracle Cloud Infrastructure (OCI) Generative AI service with Model Context Protocol (MCP) tool integration. Built using the Mastra framework for AI agent orchestration.

## Features

- 🤖 **Multi-Agent System**: Claude-like intelligent data exploration
  - Database Agent: SQL queries and connection management
  - Analysis Agent: Automatic insights and statistics  
  - Visualization Agent: Charts, tables, and interactive dashboards
  - Smart Orchestrator: Coordinates all agents seamlessly
- 🎨 **Modern Chat UI**: Clean, CopilotKit-inspired interface
  - Collapsible tool call visualization
  - Streaming responses with typing indicators
  - Suggestion chips for quick actions
  - Auto-resizing input with keyboard shortcuts
- 🔧 **MCP Tool Calling**: Execute database queries through SQLcl MCP Server
- 💬 **Streaming Responses**: Real-time streaming of AI responses
- 📝 **Conversation History**: Persistent conversation storage in Oracle Database
- 📊 **Rich Output Rendering**: Auto-generated charts, tables, and interactive HTML
- 🔍 **SQL Playground**: Direct SQL query execution and visualization
- 🌙 **Dark Mode Support**: Automatic theme detection

**See [MULTI_AGENT_GUIDE.md](./MULTI_AGENT_GUIDE.md) for detailed multi-agent system documentation.**

## Prerequisites

- Node.js 18+ 
- npm or yarn
- OCI account with Generative AI service access
- OCI CLI configured with credentials
- SQLcl MCP Server (for database operations)
- Oracle Database (optional, for conversation persistence)

## Installation

1. Clone the repository and navigate to the mastra-app directory:

```bash
cd mastra-app
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env.local` file with your configuration (see Environment Variables below)

4. Run the development server:

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Environment Variables

Create a `.env.local` file in the `mastra-app` directory with the following variables:

### Required - OCI Configuration

```bash
# OCI Configuration
OCI_CONFIG_FILE=~/.oci/config          # Path to OCI config file (default: ~/.oci/config)
OCI_PROFILE=DEFAULT                     # OCI profile name (default: DEFAULT)
OCI_COMPARTMENT_ID=ocid1.compartment... # Your OCI compartment OCID (required)
OCI_ENDPOINT=https://inference.generativeai.us-chicago-1.oci.oraclecloud.com  # OCI GenAI endpoint
```

### Required - MCP Configuration

```bash
# MCP Server Configuration
MCP_COMMAND=sqlcl                       # Command to start MCP server (required)
MCP_ARGS=                               # Comma-separated arguments for MCP command
MCP_ENV=                                # Comma-separated key=value pairs for MCP environment
```

### Optional - Database Configuration

```bash
# Oracle Database Connection (for conversation persistence)
ORACLE_CONNECTION_NAME=mydb             # SQLcl connection name for database operations
```

### Optional - Application Configuration

```bash
# Application Settings
APP_TITLE=OCI GenAI Chat                # Application title displayed in header
APP_DEFAULT_MODEL=cohere.command-r-plus-08-2024  # Default model selection
```

## Database Schema Setup

If you want to enable persistent conversation history, create the following tables in your Oracle Database:

```sql
-- Conversations table
CREATE TABLE conversations (
    id VARCHAR2(36) PRIMARY KEY,
    title VARCHAR2(500) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Messages table
CREATE TABLE messages (
    id VARCHAR2(36) PRIMARY KEY,
    conversation_id VARCHAR2(36) NOT NULL,
    role VARCHAR2(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
    content CLOB,
    tool_calls CLOB,
    tool_call_id VARCHAR2(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_conversation 
        FOREIGN KEY (conversation_id) 
        REFERENCES conversations(id) 
        ON DELETE CASCADE
);

-- Index for faster message retrieval
CREATE INDEX idx_messages_conversation ON messages(conversation_id);

-- Index for conversation search
CREATE INDEX idx_conversations_updated ON conversations(updated_at DESC);
```

## Available Scripts

```bash
# Development
npm run dev          # Start development server with hot reload

# Production
npm run build        # Build for production
npm run start        # Start production server

# Testing
npm run test         # Run tests with Vitest
npm run test:watch   # Run tests in watch mode

# Linting
npm run lint         # Run ESLint
```

## Project Structure

```
mastra-app/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API routes
│   │   │   ├── chat/          # Chat streaming endpoint
│   │   │   ├── conversations/ # Conversation CRUD endpoints
│   │   │   ├── models/        # Available models endpoint
│   │   │   └── sql/           # SQL execution endpoint
│   │   ├── page.tsx           # Main chat page
│   │   └── layout.tsx         # Root layout
│   ├── components/            # React components
│   │   ├── CopilotChatUI.tsx  # Modern chat interface (primary)
│   │   ├── ChatUI.tsx         # Legacy chat interface
│   │   ├── MessageList.tsx    # Message display
│   │   ├── ConversationSidebar.tsx  # Conversation history
│   │   ├── ModelSelector.tsx  # Model dropdown
│   │   ├── SQLPlayground.tsx  # SQL query editor
│   │   ├── OutputRenderer.tsx # Charts, tables, diagrams
│   │   ├── AnalysisCard.tsx   # Data analysis display
│   │   ├── ToolCallDisplay.tsx # Tool call visualization
│   │   └── ErrorDisplay.tsx   # Error handling UI
│   ├── config/                # Configuration loader
│   ├── db/                    # Database operations
│   │   └── conversation-store.ts  # Conversation persistence
│   ├── hooks/                 # React hooks
│   ├── lib/                   # Utilities
│   │   └── errors.ts          # Error handling utilities
│   ├── mastra/                # Mastra framework integration
│   │   ├── index.ts           # Mastra instance
│   │   ├── mcp/               # MCP client configuration
│   │   └── providers/         # OCI GenAI provider
│   └── types/                 # TypeScript types
├── __tests__/                 # Test files
│   └── property/              # Property-based tests
├── .env.local                 # Environment variables (create this)
├── package.json
└── README.md
```

## Usage

### Chat Interface

1. Select a model from the dropdown in the header
2. Type your message in the input field
3. Press Enter or click Send to submit
4. View streaming responses with markdown formatting
5. Tool calls are displayed in expandable sections

### SQL Playground

1. Click "SQL Playground" in the header to switch views
2. Enter your SQL query in the editor
3. Press Ctrl+Enter or click Execute to run
4. View results as tables, charts, or raw data
5. Recent queries are saved for quick re-execution

### Conversation Management

- Click "New Conversation" to start fresh
- Search conversations using the search bar
- Click a conversation to load its history
- Delete conversations with the trash icon

## Error Handling

The application provides user-friendly error messages for common issues:

- **OCI Authentication Errors**: Check your OCI config file and credentials
- **MCP Connection Errors**: Verify the MCP server is running
- **Database Errors**: Ensure Oracle connection is configured correctly
- **Streaming Errors**: Retry the request or simplify your message

Recoverable errors include a "Retry" button for convenience.

## Troubleshooting

### OCI Authentication Failed

1. Verify `~/.oci/config` exists and contains valid credentials
2. Check that `OCI_PROFILE` matches a profile in your config
3. Ensure `OCI_COMPARTMENT_ID` is set correctly
4. Verify your user has access to the Generative AI service

### MCP Server Not Connecting

1. Ensure SQLcl is installed and in your PATH
2. Check `MCP_COMMAND` is set correctly
3. Verify any required `MCP_ARGS` are provided
4. Check MCP server logs for errors

### Database Connection Issues

1. Verify `ORACLE_CONNECTION_NAME` matches a SQLcl connection
2. Test the connection manually with SQLcl
3. Ensure the database schema is created (see Database Schema Setup)
4. Check network connectivity to the database

### No Models Available

1. Verify OCI credentials are valid
2. Check that your compartment has access to GenAI models
3. Ensure the OCI endpoint is correct for your region

## Technology Stack

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript
- **AI Framework**: Mastra
- **OCI SDK**: oci-generativeaiinference, oci-common
- **MCP Client**: @mastra/mcp
- **Styling**: Tailwind CSS
- **Testing**: Vitest, fast-check (property-based testing)
- **Markdown**: react-markdown, rehype-highlight
- **Charts**: Recharts

## License

This project is part of the OCI GenAI MCP Chat application suite.
