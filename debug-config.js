const ConfigManager = require('./src/config/ConfigManager');

async function testConfig() {
  console.log('Testing ConfigManager...');
  
  const configManager = new ConfigManager();
  
  try {
    console.log('Setting test value...');
    const result = await configManager.set('test', 'value');
    console.log('Set result:', result);
    console.log('Set result type:', typeof result);
    console.log('Is result a promise?', result instanceof Promise);
    
    console.log('Getting test value...');
    const value = await configManager.get('test');
    console.log('Get result:', value);
    
    // Test with the config CLI
    console.log('\nTesting CLI config command...');
    const configCommand = require('./src/cli/config');
    console.log('configCommand:', Object.keys(configCommand));
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testConfig();
