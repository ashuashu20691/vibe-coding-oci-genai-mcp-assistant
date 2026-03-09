// Script to initialize database schema with all required columns
import { loadConfig, isOracleConfigured } from '../src/config';
import { ConversationStore } from '../src/db/conversation-store';

async function initDatabase() {
  console.log('Initializing database schema...');
  
  const config = loadConfig();
  
  if (!isOracleConfigured(config)) {
    console.error('Oracle database is not configured. Please check your .env file.');
    process.exit(1);
  }
  
  const store = new ConversationStore(config.oracle);
  
  try {
    // Initialize connection
    await store.initialize();
    console.log('✓ Database connection established');
    
    // Import the executeStatement function
    const { executeStatement } = await import('../src/db/oracle-client');
    
    // Create conversations table
    console.log('Creating conversations table...');
    try {
      await executeStatement(`
        CREATE TABLE conversations (
          id VARCHAR2(36) PRIMARY KEY,
          title VARCHAR2(500) NOT NULL,
          model_id VARCHAR2(200),
          active_artifact CLOB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✓ Conversations table created');
    } catch (e: any) {
      if (e.message?.includes('ORA-00955') || e.message?.includes('name is already used')) {
        console.log('✓ Conversations table already exists');
      } else {
        throw e;
      }
    }
    
    // Create messages table with all columns
    console.log('Creating messages table...');
    try {
      await executeStatement(`
        CREATE TABLE messages (
          id VARCHAR2(36) PRIMARY KEY,
          conversation_id VARCHAR2(36) NOT NULL,
          role VARCHAR2(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
          content CLOB,
          tool_calls CLOB,
          tool_call_id VARCHAR2(100),
          tool_narratives CLOB,
          adaptation_narratives CLOB,
          visualization CLOB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_conversation 
            FOREIGN KEY (conversation_id) 
            REFERENCES conversations(id) 
            ON DELETE CASCADE
        )
      `);
      console.log('✓ Messages table created');
    } catch (e: any) {
      if (e.message?.includes('ORA-00955') || e.message?.includes('name is already used')) {
        console.log('✓ Messages table already exists');
        
        // Try to add missing columns if table exists
        console.log('Checking for missing columns...');
        
        const columnsToAdd = [
          { name: 'tool_narratives', type: 'CLOB' },
          { name: 'adaptation_narratives', type: 'CLOB' },
          { name: 'visualization', type: 'CLOB' },
          { name: 'model_id', type: 'VARCHAR2(200)', table: 'conversations' },
          { name: 'active_artifact', type: 'CLOB', table: 'conversations' },
        ];
        
        for (const col of columnsToAdd) {
          const tableName = col.table || 'messages';
          try {
            await executeStatement(`ALTER TABLE ${tableName} ADD (${col.name} ${col.type})`);
            console.log(`✓ Added ${col.name} column to ${tableName} table`);
          } catch (alterError: any) {
            if (alterError.message?.includes('ORA-01430') || alterError.message?.includes('already exists')) {
              console.log(`  ${col.name} column already exists in ${tableName}`);
            } else {
              console.warn(`  Warning: Could not add ${col.name} to ${tableName}:`, alterError.message);
            }
          }
        }
      } else {
        throw e;
      }
    }
    
    // Create indexes
    console.log('Creating indexes...');
    try {
      await executeStatement(`CREATE INDEX idx_messages_conversation ON messages(conversation_id)`);
      console.log('✓ Created idx_messages_conversation');
    } catch (e: any) {
      if (e.message?.includes('ORA-00955') || e.message?.includes('name is already used')) {
        console.log('✓ idx_messages_conversation already exists');
      } else {
        console.warn('  Warning: Could not create idx_messages_conversation:', e.message);
      }
    }
    
    try {
      await executeStatement(`CREATE INDEX idx_conversations_updated ON conversations(updated_at DESC)`);
      console.log('✓ Created idx_conversations_updated');
    } catch (e: any) {
      if (e.message?.includes('ORA-00955') || e.message?.includes('name is already used')) {
        console.log('✓ idx_conversations_updated already exists');
      } else {
        console.warn('  Warning: Could not create idx_conversations_updated:', e.message);
      }
    }
    
    console.log('\n✅ Database schema initialization complete!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
}

initDatabase();
