# Mastra App - Architecture Diagram

## System Overview

The Mastra App is a Next.js-based AI chat application that integrates Oracle Cloud Infrastructure (OCI) Generative AI with a multi-agent system for intelligent database exploration, analysis, and visualization.

## High-Level Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        UI[React UI Components]
        Chat[CopilotChatUI]
        SQL[SQL Playground]
        Sidebar[Conversation Sidebar]
    end

    subgraph "Next.js App Router"
        Pages[Pages & Layouts]
        API[API Routes]
    end

    subgraph "API Endpoints"
        ChatAPI["API: /api/chat"]
        ConvAPI["API: /api/conversations"]
        SQLAPI["API: /api/sql"]
        ModelsAPI["API: /api/models"]
        DBAPI["API: /api/databases"]
        AnalyzeAPI["API: /api/analyze"]
    end

    subgraph "Services Layer"
        ChatService[Chat Service]
        WorkflowOrch[Workflow Orchestrator]
        QueryEngine[Query Engine]
        ResultPresenter[Result Presenter]
        ExportService[Export Service]
        ReportGen[Automatic Report Generator]
    end

    subgraph "Multi-Agent System"
        Orchestrator[Database Orchestrator]
        DBAgent[Database Agent]
        AnalysisAgent[Data Analysis Agent]
        VizAgent[Visualization Agent]
        SupervisorAgent[Supervisor Agent]
    end

    subgraph "Mastra Framework"
        MastraCore[Mastra Core]
        MCPClient[MCP Client]
        OCIProvider[OCI GenAI Provider]
    end

    subgraph "External Services"
        OCI[OCI Generative AI]
        SQLcl[SQLcl MCP Server]
        OracleDB[(Oracle Database)]
    end

    subgraph "Data Layer"
        ConvStore[Conversation Store]
        OracleClient[Oracle Client]
    end

    UI --> Pages
    Chat --> API
    SQL --> API
    Sidebar --> API
    
    Pages --> API
    API --> ChatAPI
    API --> ConvAPI
    API --> SQLAPI
    API --> ModelsAPI
    API --> DBAPI
    API --> AnalyzeAPI
    
    ChatAPI --> ChatService
    ChatAPI --> WorkflowOrch
    SQLAPI --> QueryEngine
    AnalyzeAPI --> ResultPresenter
    ConvAPI --> ConvStore
    
    ChatService --> Orchestrator
    WorkflowOrch --> Orchestrator
    QueryEngine --> DBAgent
    
    Orchestrator --> DBAgent
    Orchestrator --> AnalysisAgent
    Orchestrator --> VizAgent
    Orchestrator --> SupervisorAgent
    
    DBAgent --> MastraCore
    AnalysisAgent --> MastraCore
    VizAgent --> MastraCore
    
    MastraCore --> MCPClient
    MastraCore --> OCIProvider
    
    MCPClient --> SQLcl
    OCIProvider --> OCI
    SQLcl --> OracleDB
    
    ConvStore --> OracleClient
    OracleClient --> OracleDB
    
    ResultPresenter --> ExportService
    ReportGen --> ExportService
```

## Detailed Component Architecture

### 1. Frontend Layer

```mermaid
graph LR
    subgraph "UI Components"
        CopilotUI[CopilotChatUI]
        MessageList[MessageList]
        InputArea[Input Area]
        
        subgraph "Visualization Components"
            Chart[Chart]
            DataTable[DataTable]
            Dashboard[Dashboard Renderer]
            Mermaid[Mermaid Diagram]
            Map[Map Renderer]
        end
        
        subgraph "Tool Display"
            ToolExec[Tool Execution Display]
            ToolCall[Tool Call Display]
            AgentThink[Agent Thinking]
        end
        
        subgraph "Sidebar Components"
            ConvSidebar[Conversation Sidebar]
            ModelSelector[Model Selector]
            DBSelector[Database Selector]
        end
        
        subgraph "Utilities"
            ErrorDisplay[Error Display]
            Progress[Progress Indicator]
            Export[Export Dropdown]
        end
    end
    
    CopilotUI --> MessageList
    CopilotUI --> InputArea
    MessageList --> Chart
    MessageList --> DataTable
    MessageList --> Dashboard
    MessageList --> ToolExec
    MessageList --> AgentThink
    
    CopilotUI --> ConvSidebar
    CopilotUI --> ModelSelector
```

### 2. API Routes Architecture

```mermaid
graph TB
    subgraph "API Routes"
        direction TB
        
        Chat["POST /api/chat<br/>Stream chat responses"]
        Conv["GET/POST /api/conversations<br/>Manage conversations"]
        ConvID["GET/DELETE /api/conversations/:id<br/>Single conversation"]
        SQL["POST /api/sql<br/>Execute SQL queries"]
        Models["GET /api/models<br/>List available models"]
        DB["GET /api/databases<br/>List connections"]
        DBConnect["POST /api/databases/connect<br/>Connect to database"]
        Analyze["POST /api/analyze<br/>Analyze data"]
        Embed["POST /api/embeddings<br/>Generate embeddings"]
        Settings["GET/POST /api/settings<br/>App settings"]
    end
    
    Chat --> |Streaming| ChatService[Chat Service]
    Conv --> ConvStore[Conversation Store]
    ConvID --> ConvStore
    SQL --> QueryEngine[Query Engine]
    Models --> OCIProvider[OCI Provider]
    DB --> MCPClient[MCP Client]
    DBConnect --> MCPClient
    Analyze --> ResultPresenter[Result Presenter]
```

### 3. Multi-Agent System Architecture

```mermaid
graph TB
    subgraph "Multi-Agent Orchestration"
        User[User Query] --> Orchestrator[Database Orchestrator]
        
        Orchestrator --> |1. Execute Query| DBAgent[Database Agent]
        Orchestrator --> |2. Analyze Results| AnalysisAgent[Analysis Agent]
        Orchestrator --> |3. Create Visuals| VizAgent[Visualization Agent]
        Orchestrator --> |4. Supervise| Supervisor[Supervisor Agent]
        
        subgraph "Database Agent"
            DBTools[MCP Tools]
            Connect[sqlcl_connect]
            RunSQL[sqlcl_run_sql]
            Schema[sqlcl_schema_information]
            ListConn[sqlcl_list_connections]
        end
        
        subgraph "Analysis Agent"
            Stats[Calculate Statistics]
            Insights[Generate Insights]
            Patterns[Detect Patterns]
            Recommend[Recommendations]
        end
        
        subgraph "Visualization Agent"
            AutoDetect[Auto-detect Chart Type]
            GenChart[Generate Charts]
            GenTable[Generate Tables]
            GenHTML[Generate HTML Dashboard]
        end
        
        DBAgent --> DBTools
        DBTools --> Connect
        DBTools --> RunSQL
        DBTools --> Schema
        DBTools --> ListConn
        
        AnalysisAgent --> Stats
        AnalysisAgent --> Insights
        AnalysisAgent --> Patterns
        AnalysisAgent --> Recommend
        
        VizAgent --> AutoDetect
        VizAgent --> GenChart
        VizAgent --> GenTable
        VizAgent --> GenHTML
        
        Supervisor --> |Coordinate| Orchestrator
    end
    
    DBAgent --> |Query Results| AnalysisAgent
    AnalysisAgent --> |Analysis Data| VizAgent
    VizAgent --> |Visualizations| Response[Response to User]
```

### 4. Service Layer Architecture

```mermaid
graph TB
    subgraph "Core Services"
        ChatSvc[Chat Service]
        WorkflowOrch[Workflow Orchestrator]
        QueryEngine[Query Engine]
        ResultPresenter[Result Presenter]
    end
    
    subgraph "Analysis Services"
        IntentAnalyzer[Intent Analyzer]
        DataProfiler[Data Profiler]
        SchemaDiscovery[Schema Discovery]
        ConvNarrator[Conversational Narrator]
    end
    
    subgraph "Visualization Services"
        VizSelector[Visualization Selector]
        DashboardComposer[Dashboard Composer]
        DataSynthesizer[Data Synthesizer]
    end
    
    subgraph "Export Services"
        ExportSvc[Export Service]
        ImageEmbed[Image Embedding Service]
        DashExport[Dashboard Export Integration]
    end
    
    subgraph "Report Generation"
        ReportOrch[Report Generation Orchestrator]
        ReportTrigger[Report Trigger Detector]
        ChatReportRender[Chat Report Renderer]
        ConfigMgr[Config Manager]
        ErrorRecovery[Error Recovery]
    end
    
    subgraph "Utilities"
        RetryOrch[Retry Orchestrator]
        ContextMgr[Context Manager]
        ResultRouting[Result Routing]
    end
    
    ChatSvc --> WorkflowOrch
    WorkflowOrch --> QueryEngine
    WorkflowOrch --> IntentAnalyzer
    
    QueryEngine --> SchemaDiscovery
    QueryEngine --> DataProfiler
    
    ResultPresenter --> VizSelector
    ResultPresenter --> DashboardComposer
    ResultPresenter --> ConvNarrator
    
    ExportSvc --> ImageEmbed
    ExportSvc --> DashExport
    
    ReportOrch --> ReportTrigger
    ReportOrch --> ChatReportRender
    ReportOrch --> ConfigMgr
    ReportOrch --> ErrorRecovery
```

### 5. Data Flow Architecture

```mermaid
sequenceDiagram
    participant User
    participant UI as CopilotChatUI
    participant API as /api/chat
    participant ChatSvc as Chat Service
    participant Orch as Orchestrator
    participant DBAgent as Database Agent
    participant Analysis as Analysis Agent
    participant Viz as Visualization Agent
    participant MCP as MCP Client
    participant OCI as OCI GenAI
    participant DB as Oracle Database
    
    User->>UI: Enter query
    UI->>API: POST /api/chat (stream)
    API->>ChatSvc: Process message
    ChatSvc->>OCI: Generate response
    OCI->>ChatSvc: Stream tokens
    
    alt Tool Call Detected
        ChatSvc->>Orch: Execute tool
        Orch->>DBAgent: Run SQL query
        DBAgent->>MCP: sqlcl_run_sql
        MCP->>DB: Execute query
        DB->>MCP: Results
        MCP->>DBAgent: Query results
        
        DBAgent->>Analysis: Analyze data
        Analysis->>Analysis: Calculate stats
        Analysis->>Analysis: Generate insights
        Analysis->>Orch: Analysis results
        
        Orch->>Viz: Create visualization
        Viz->>Viz: Auto-detect chart type
        Viz->>Viz: Generate chart/table
        Viz->>Orch: Visualization data
        
        Orch->>ChatSvc: Combined results
    end
    
    ChatSvc->>API: Stream response
    API->>UI: Server-Sent Events
    UI->>User: Display message + visuals
```

### 6. Database Schema

```mermaid
erDiagram
    CONVERSATIONS ||--o{ MESSAGES : contains
    
    CONVERSATIONS {
        varchar2 id PK
        varchar2 title
        timestamp created_at
        timestamp updated_at
    }
    
    MESSAGES {
        varchar2 id PK
        varchar2 conversation_id FK
        varchar2 role
        clob content
        clob tool_calls
        varchar2 tool_call_id
        timestamp created_at
    }
```

## Technology Stack

### Frontend
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **UI Library**: React 19
- **Styling**: Tailwind CSS 4
- **Charts**: Recharts
- **Markdown**: react-markdown, rehype-highlight
- **Diagrams**: Mermaid
- **Maps**: Leaflet, react-leaflet

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Next.js API Routes
- **AI Framework**: Mastra Core
- **MCP Client**: @mastra/mcp
- **OCI SDK**: oci-generativeaiinference, oci-common
- **Database**: oracledb

### Testing
- **Test Framework**: Vitest
- **Property Testing**: fast-check
- **Testing Library**: @testing-library/react
- **DOM Testing**: jsdom

### External Services
- **AI Provider**: OCI Generative AI
- **MCP Server**: SQLcl MCP Server
- **Database**: Oracle Database

## Key Features

### 1. Multi-Agent Intelligence
- Database operations and SQL execution
- Automatic data analysis and insights
- Automatic visualization generation
- Coordinated multi-step workflows

### 2. Rich Visualizations
- Auto-detected chart types (bar, line, pie, scatter)
- Interactive data tables with sorting
- HTML dashboards with filtering
- Mermaid diagrams
- Geographic maps

### 3. Conversation Management
- Persistent conversation history
- Search and filter conversations
- Message threading
- Context preservation

### 4. Export Capabilities
- CSV export
- Excel export with formatting
- HTML export (self-contained)
- Image embedding in exports

### 5. Automatic Report Generation
- Trigger detection from user queries
- Multi-page report generation
- Chart and table integration
- Error recovery and retry logic

### 6. Developer Experience
- Comprehensive test coverage (unit, integration, property-based)
- Type-safe TypeScript throughout
- Modular service architecture
- Extensible agent system

## Deployment Architecture

```mermaid
graph TB
    subgraph "Production Environment"
        LB[Load Balancer]
        
        subgraph "Application Servers"
            App1[Next.js App Instance 1]
            App2[Next.js App Instance 2]
        end
        
        subgraph "Process Manager"
            PM2[PM2 Cluster Mode]
        end
        
        subgraph "Database"
            OracleDB[(Oracle Database)]
        end
        
        subgraph "External Services"
            OCI[OCI GenAI Service]
            SQLcl[SQLcl MCP Server]
        end
        
        subgraph "Monitoring"
            Logs[Application Logs]
            Health[Health Checks]
            Metrics[Performance Metrics]
        end
    end
    
    LB --> App1
    LB --> App2
    PM2 --> App1
    PM2 --> App2
    
    App1 --> OracleDB
    App2 --> OracleDB
    App1 --> OCI
    App2 --> OCI
    App1 --> SQLcl
    App2 --> SQLcl
    
    App1 --> Logs
    App2 --> Logs
    App1 --> Health
    App2 --> Health
```

## Security Considerations

1. **Authentication**: OCI credentials via config file
2. **Authorization**: Compartment-based access control
3. **Data Protection**: HTTPS for all external communications
4. **SQL Injection**: Parameterized queries via SQLcl
5. **Environment Variables**: Sensitive data in .env files
6. **Database Security**: Oracle Database native security features

## Performance Optimizations

1. **Streaming Responses**: Real-time token streaming for better UX
2. **Connection Pooling**: Reuse database connections
3. **Caching**: Model list and schema information caching
4. **Lazy Loading**: Components loaded on demand
5. **Code Splitting**: Next.js automatic code splitting
6. **PM2 Cluster Mode**: Multi-process for production

## Scalability

1. **Horizontal Scaling**: Multiple Next.js instances behind load balancer
2. **Stateless Design**: No server-side session state
3. **Database Persistence**: All state in Oracle Database
4. **MCP Server**: Separate process for database operations
5. **OCI GenAI**: Managed service with auto-scaling

## Future Enhancements

1. **Additional AI Models**: Support for more OCI models
2. **Advanced Analytics**: ML-powered insights
3. **Collaboration**: Multi-user conversations
4. **Real-time Updates**: WebSocket for live data
5. **Custom Visualizations**: User-defined chart types
6. **API Gateway**: Rate limiting and authentication
7. **Caching Layer**: Redis for performance
8. **Observability**: Distributed tracing and monitoring

---

**Last Updated**: March 2026
**Version**: 0.2.0
