import { CopilotChatUI } from '@/components/CopilotChatUI';

/**
 * Main page component for OCI GenAI Chat application.
 * Uses CopilotKit with AG-UI Protocol for agentic frontend.
 * 
 * Requirement 11.2: The `mastra-app/` directory SHALL contain a complete Next.js project structure
 */
export default function Home() {
  const appTitle = process.env.APP_TITLE || 'OCI GenAI Chat';

  return <CopilotChatUI appTitle={appTitle} />;
}
