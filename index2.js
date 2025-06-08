const { GoogleGenerativeAI } = require("@google/generative-ai");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const { ENV_KEYS } = require("./config");

const execAsync = promisify(exec);

const API_KEYS = [
    ENV_KEYS.GEMINI_API_KEY_1,
    ENV_KEYS.GEMINI_API_KEY_2,
    ENV_KEYS.GEMINI_API_KEY_3
];

let currentKeyIndex = 0;
let genAI = new GoogleGenerativeAI(API_KEYS[currentKeyIndex]);

function rotateApiKey() {
    currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
    genAI = new GoogleGenerativeAI(API_KEYS[currentKeyIndex]);
    console.log(`🔄 Rotated to API key ${currentKeyIndex + 1}`);
    return genAI;
}

function getWeatherInfo(city) {
    return `The weather in ${city} is 45 degrees celsius.`;
}

async function executeCommand(command) {
    try {
        console.log(`Executing: ${command}`);
        const { stdout, stderr } = await execAsync(command, { 
            cwd: process.cwd(),
            timeout: 30000
        });
        
        let result = '';
        if (stdout) result += stdout;
        if (stderr) result += `\nSTDERR: ${stderr}`;
        
        return result || 'Command executed successfully (no output)';
    } catch (error) {
        return `Error executing command: ${error.message}`;
    }
}

async function createFile(filePath, content = '') {
    try {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        fs.writeFileSync(filePath, content, 'utf8');
        return `File created successfully: ${filePath}`;
    } catch (error) {
        return `Error creating file: ${error.message}`;
    }
}

async function readFile(filePath) {
    try {
        if (!fs.existsSync(filePath)) {
            return `File not found: ${filePath}`;
        }
        
        const content = fs.readFileSync(filePath, 'utf8');
        return `File content of ${filePath}:\n${content}`;
    } catch (error) {
        return `Error reading file: ${error.message}`;
    }
}

async function writeToFile(filePath, content) {
    try {
        console.log(`Writing to file: ${filePath}`);
        console.log(`Content length: ${content.length}`);
        console.log(`Content preview: ${content.substring(0, 100)}...`);
        
        fs.writeFileSync(filePath, content, 'utf8');
        return `Content written to file: ${filePath} (${content.length} characters)`;
    } catch (error) {
        console.error(`Error writing to file ${filePath}:`, error);
        return `Error writing to file: ${error.message}`;
    }
}

async function appendToFile(filePath, content) {
    try {
        fs.appendFileSync(filePath, content, 'utf8');
        return `Content appended to file: ${filePath}`;
    } catch (error) {
        return `Error appending to file: ${error.message}`;
    }
}

async function listDirectory(dirPath = '.') {
    try {
        const items = fs.readdirSync(dirPath);
        const details = items.map(item => {
            const fullPath = path.join(dirPath, item);
            const stats = fs.statSync(fullPath);
            return `${stats.isDirectory() ? 'DIR' : 'FILE'}: ${item}`;
        });
        return `Directory listing for ${dirPath}:\n${details.join('\n')}`;
    } catch (error) {
        return `Error listing directory: ${error.message}`;
    }
}

function isWebProject(query) {
    const webKeywords = [
        'html', 'css', 'js', 'javascript', 'web', 'website', 'app', 'application',
        'frontend', 'front-end', 'ui', 'interface', 'page', 'site', 'project',
        'create', 'build', 'make', 'develop'
    ];
    
    const lowerQuery = query.toLowerCase();
    
    return webKeywords.some(keyword => lowerQuery.includes(keyword)) &&
           (lowerQuery.includes('html') || lowerQuery.includes('css') || lowerQuery.includes('js') || 
            lowerQuery.includes('web') || lowerQuery.includes('app') || lowerQuery.includes('site'));
}

function detectProjectDirectory(query) {
    const folderMatches = query.match(/(?:folder|directory|dir)\s+([a-zA-Z0-9-_]+)/i);
    if (folderMatches) {
        return folderMatches[1];
    }
    
    const createMatches = query.match(/create\s+(?:a\s+)?(?:folder\s+)?([a-zA-Z0-9-_]+)/i);
    if (createMatches && createMatches[1] !== 'a' && createMatches[1] !== 'an') {
        return createMatches[1];
    }
    
    const appMatches = query.match(/([a-zA-Z0-9-_]+)[-\s]?(?:app|application|project|site|website)/i);
    if (appMatches) {
        return appMatches[1];
    }
    
    return '.';
}

async function validateWebProject(projectDir) {
    const requiredFiles = ['index.html', 'styles.css', 'script.js'];
    
    console.log(`🔍 Validating web project in directory: ${projectDir}`);
    
    if (projectDir !== '.' && !fs.existsSync(projectDir)) {
        console.log(`❌ Project directory ${projectDir} does not exist`);
        return {
            isComplete: false,
            existingFiles: [],
            missingFiles: requiredFiles.map(f => `${projectDir}/${f}`),
            feedbackMessage: `Project directory ${projectDir} does not exist. Create the directory and all required files: ${requiredFiles.join(', ')}.`
        };
    }
    
    let allFilesExist = true;
    let existingFiles = [];
    let missingFiles = [];
    
    for (const file of requiredFiles) {
        const filePath = projectDir === '.' ? file : `${projectDir}/${file}`;
        if (fs.existsSync(filePath)) {
            existingFiles.push(filePath);
            console.log(`✅ Found: ${filePath}`);
            
            const stats = fs.statSync(filePath);
            if (stats.size === 0) {
                console.log(`⚠️ Warning: ${filePath} is empty`);
            } else {
                console.log(`📄 ${filePath} (${stats.size} bytes)`);
            }
        } else {
            missingFiles.push(filePath);
            console.log(`❌ Missing: ${filePath}`);
            allFilesExist = false;
        }
    }
    
    return {
        isComplete: allFilesExist,
        existingFiles: existingFiles,
        missingFiles: missingFiles,
        feedbackMessage: allFilesExist 
            ? "Project is complete with all required files."
            : `Project is incomplete. Missing files: ${missingFiles.join(', ')}. A complete web project needs index.html, styles.css, and script.js with full functionality. Continue creating the missing files and ensure they contain complete working code.`
    };
}

const toolMap = {
    getWeatherInfo: getWeatherInfo,
    executeCommand: executeCommand,
    createFile: createFile,
    readFile: readFile,
    writeToFile: writeToFile,
    appendToFile: appendToFile,
    listDirectory: listDirectory
}

const SYSTEM_PROMPT = `
You are an advanced AI coding assistant similar to Cursor IDE. You can interact with the file system, execute commands, and help with coding tasks.

You work in START, THINK, ACTION, OBSERVER and OUTPUT modes.

Available tools:
- getWeatherInfo(city: string): Get weather information
- executeCommand(command: string): Execute shell/cmd commands
- createFile(filePath: string, content?: string): Create a new file with optional content
- readFile(filePath: string): Read content from a file
- writeToFile(filePath: string, content: string): Write content to a file (overwrites)
- appendToFile(filePath: string, content: string): Append content to a file
- listDirectory(dirPath?: string): List files and directories (default: current directory)

CAPABILITIES:
- Create and manage files and directories
- Execute system commands (npm install, git commands, etc.)
- Write, read, and modify code files
- Run scripts and programs
- Manage project structure
- Install dependencies
- Run tests and builds

CRITICAL RULES FOR PROJECT COMPLETION:
- NEVER output "output" step until ALL required files are created and working
- For web applications (HTML/CSS/JS projects), you MUST create AT MINIMUM: index.html, styles.css, and script.js
- ALL files must contain complete, functional code - NO placeholders or TODO comments
- Before ending with "output" step, think through what files are needed for a complete working application
- Test your logic by listing files to verify all components exist
- Each file must be fully implemented with proper functionality

CRITICAL RULES FOR RESPONSES:
- Always output ONLY raw JSON without markdown formatting
- Do NOT wrap responses in \`\`\`json blocks
- Output only ONE JSON object per response
- Wait for OBSERVER feedback after each ACTION
- Be careful with destructive commands (ask for confirmation)
- Use relative paths when possible
- For file content with multiple lines, use \\n for newlines
- When passing file content, format as: "filepath,content here"

SPECIFIC REQUIREMENTS FOR WEB PROJECTS:
When creating any web application/project, you MUST create these files with full functionality:
1. index.html - Complete HTML structure with proper DOCTYPE, head, body, and links to CSS/JS
2. styles.css - Complete styling for the entire application with responsive design
3. script.js - Complete JavaScript with all required functionality and event handlers
4. All features requested by the user must be fully implemented and working

Output formats (choose ONE per response):
{"step": "think", "content": "your reasoning"}
{"step": "action", "tool": "toolName", "input": "parameters"}
{"step": "output", "content": "final response to user"}

Examples for file operations:
- Create empty file: {"step": "action", "tool": "createFile", "input": "index.html"}
- Create file with content: {"step": "action", "tool": "createFile", "input": "index.html,<!DOCTYPE html>\\n<html>\\n<head>\\n<title>Hello</title>\\n</head>\\n<body>\\n<h1>Hello World</h1>\\n</body>\\n</html>"}
- Write to file: {"step": "action", "tool": "writeToFile", "input": "app.js,const express = require('express');\\nconst app = express();\\n\\napp.listen(3000);"}
- Execute command: {"step": "action", "tool": "executeCommand", "input": "mkdir new-folder"}

IMPORTANT: When creating HTML/CSS/JS files, always include complete, working code with proper structure.

Remember: Output ONLY the JSON object, no extra text or formatting.
`;

async function init() {
    let model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    let chat = model.startChat({
        history: [
            {
                role: "user",
                parts: [
                    { text: SYSTEM_PROMPT }
                ]
            },
        ],
    });

    const userQuery = process.argv[2] || 'Create a folder called backend-new and create a simgle get request api with express and node js';
    // const userQuery = process.argv[2] || 'Create a folder todo-app and create a todo app with HTML CSS and JS fully working';
    console.log(`\n🤖 AI Assistant: Processing query: "${userQuery}"\n`);
    
    await chat.sendMessage(userQuery);
    
    let stepCount = 0;
    const MAX_STEPS = 30;
    let consecutiveRateLimits = 0;
    const MAX_CONSECUTIVE_RATE_LIMITS = 3; 
    
    while(stepCount < MAX_STEPS) {
        stepCount++;
        
        try {
            const res = await chat.sendMessage("");
            const resText = res.response.text().trim();
            
            consecutiveRateLimits = 0;
            
            if (!resText) {
                console.log('Empty response, continuing...');
                continue;
            }

            let parsed;
            try {
                let cleanedText = resText;
                
                if (resText.includes('```json')) {
                    const jsonMatch = resText.match(/```json\s*(\{.*?\})\s*```/s);
                    if (jsonMatch) {
                        cleanedText = jsonMatch[1];
                    } else {
                        const firstJsonMatch = resText.match(/```json\s*(\{[^`]*?\})/s);
                        if (firstJsonMatch) {
                            cleanedText = firstJsonMatch[1];
                        }
                    }
                }
                
                parsed = JSON.parse(cleanedText);
            } catch (error) {
                console.log('❌ Error parsing JSON: ', error.message);
                console.log('Raw response: ', resText);
                
                if (!resText.includes('{') && !resText.includes('}')) {
                    console.log('Skipping non-JSON response...');
                    break;
                }
                continue;
            }
                
            if(parsed.step === "think") {
                console.log('🤔 THINK: ', parsed.content);
                continue;
            } else if(parsed.step === "action") {
                console.log('⚡ ACTION: ', parsed.tool, parsed.input);
                const tool = parsed.tool;
                const input = parsed.input;
                
                if (!toolMap[tool]) {
                    console.log('❌ Unknown tool: ', tool);
                    await chat.sendMessage(
                        JSON.stringify({ step: "observer", content: `Error: Unknown tool ${tool}` })
                    );
                    continue;
                }
                
                console.log('🔧 Executing tool: ', tool);
                
                let toolOutput;
                try {
                    let params;
                    
                    console.log(`Raw input for ${tool}:`, input);
                    
                    if (tool === 'writeToFile' || tool === 'appendToFile' || tool === 'createFile') {
                        const commaIndex = input.indexOf(',');
                        if (commaIndex > 0) {
                            const filePath = input.substring(0, commaIndex).trim();
                            const content = input.substring(commaIndex + 1);
                            params = [filePath, content];
                            console.log(`Parsed params for ${tool}:`, { filePath, contentLength: content.length });
                        } else {
                            params = [input.trim()];
                        }
                    } else {
                        params = input.includes(',') && tool !== 'executeCommand' ? input.split(',').map(p => p.trim()) : [input.trim()];
                    }
                    
                    toolOutput = await toolMap[tool](...params);
                } catch (toolError) {
                    console.error(`Tool error for ${tool}:`, toolError);
                    toolOutput = `Tool execution error: ${toolError.message}`;
                }
                
                console.log('📋 Tool output: ', toolOutput);
                
                await chat.sendMessage(
                    JSON.stringify({ step: "observer", content: toolOutput })
                );            
                continue;
            } else if(parsed.step === "observer") {
                console.log('👁️ OBSERVER: ', parsed.content);
                continue;
            } else if(parsed.step === "output") {
                if (isWebProject(userQuery)) {
                    const projectDir = detectProjectDirectory(userQuery);
                    const validation = await validateWebProject(projectDir);
                    
                    if (!validation.isComplete) {
                        console.log('❌ Project incomplete. Sending feedback to continue...');
                        await chat.sendMessage(
                            JSON.stringify({ 
                                step: "observer", 
                                content: validation.feedbackMessage
                            })
                        );
                        continue;
                    } else {
                        console.log('✅ All required files found. Project validation passed.');
                    }
                }
                
                console.log('✅ OUTPUT: ', parsed.content);
                break;
            } else {
                console.log('❓ Unknown step: ', parsed.step);
                console.log('Full response: ', parsed);
                break;
            }
        } catch (error) {
            if (error.status === 429) {
                consecutiveRateLimits++;
                console.log(`⚠️ Rate limit hit on API key ${currentKeyIndex + 1}. Consecutive rate limits: ${consecutiveRateLimits}`);
                
                let retryDelay = 60; 
                if (error.errorDetails) {
                    const retryInfo = error.errorDetails.find(detail => detail['@type'] === 'type.googleapis.com/google.rpc.RetryInfo');
                    if (retryInfo && retryInfo.retryDelay) {
                        const delayMatch = retryInfo.retryDelay.match(/(\d+)s/);
                        if (delayMatch) {
                            retryDelay = parseInt(delayMatch[1]);
                        }
                    }
                }
                
                if (consecutiveRateLimits >= MAX_CONSECUTIVE_RATE_LIMITS) {
                    console.log(`🛑 All API keys have hit rate limits. Waiting ${retryDelay} seconds before retrying...`);
                    await new Promise(resolve => setTimeout(resolve, retryDelay * 1000));
                    consecutiveRateLimits = 0; 
                } else {
                    rotateApiKey();
                    model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
                    
                    chat = model.startChat({
                        history: [
                            {
                                role: "user",
                                parts: [
                                    { text: SYSTEM_PROMPT }
                                ]
                            },
                        ],
                    });
                    
                    await chat.sendMessage(userQuery);
                    console.log('🔄 Reinitialized chat with new API key');
                }
                
                stepCount--; 
                continue;
            } else if (error.status === 400 && error.errorDetails && 
                      error.errorDetails.some(detail => detail.reason === 'API_KEY_INVALID')) {
                console.log(`⚠️ Invalid API key ${currentKeyIndex + 1}. Rotating to next key...`);
                consecutiveRateLimits++;
                
                if (consecutiveRateLimits >= API_KEYS.length) {
                    console.log('🛑 All API keys are invalid or exhausted. Please check your API keys.');
                    break;
                } else {
                    rotateApiKey();
                    model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
                    
                    chat = model.startChat({
                        history: [
                            {
                                role: "user",
                                parts: [
                                    { text: SYSTEM_PROMPT }
                                ]
                            },
                        ],
                    });
                    
                    await chat.sendMessage(userQuery);
                    console.log('🔄 Reinitialized chat with new API key after invalid key');
                }
                
                stepCount--;
                continue;
            } else {
                console.error('❌ Error in chat loop:', error);
                break;
            }
        }
    }
    
    if (stepCount >= MAX_STEPS) {
        console.log('⚠️ Reached maximum steps limit. Exiting...');
    }
    
    console.log('\n🎉 AI Assistant session completed!');
}

process.on('SIGINT', () => {
    console.log('\n👋 AI Assistant shutting down...');
    process.exit(0);
});

init().catch(console.error);