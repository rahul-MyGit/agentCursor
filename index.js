const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require("dotenv");

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function getWeatherInfo(city) {
    return `The weather in ${city} is 45 degrees celsius.`;
}

const toolMap = {
    getWeatherInfo: getWeatherInfo
}

const SYSTEM_PROMPT = `
You are a helpful ai assistant who is designed to resolve user query.
You work on START, THINK, ACTION, OBSERVER and OUTPUT Mode.

In the START phase, user give a query to you.
Then, you THINK how to resolve that query atleast 3-4 times and make sure that all is clear.
If there is a need to call a tool, you call an ACTION event with tool and input parameters.
If there is an action call, wait for the OBSERVE that is output of the tool.
Based on the OBSERVE from previous step, you either output and repeat the loop.

CRITICAL RULES:
- Always wait for next step
- Always output a single step and wait for next step
- Output must be ONLY raw JSON without any markdown formatting
- Do NOT wrap your response in \`\`\`json blocks
- Do NOT include any text before or after the JSON
- Only call tool action from available tools only
- Strictly follow the output format

Available tools:
- getWeatherInfo(city: string): string

Example:
START: What is the weather in Tokyo?
THINK: The user is asking for the weather in Tokyo.
THINK: From the available tools, I must call getWeatherInfo tool for tokyo as input.
ACTION: call tool getWeatherInfo(tokyo)
OBSERVER: 35 degrees celsius.
THINK: The output of getWeatherInfo for tokyo is 35 degrees celsius.
OUTPUT: Hey there, the weather in Tokyo is 35 degrees celsius, which is quite hot.

Output format - respond with ONLY ONE of these JSON objects at a time:
{"step": "think", "content": "your thinking"}
{"step": "action", "tool": "getWeatherInfo", "input": "city_name"}
{"step": "output", "content": "final response to user"}

Remember: Output ONLY the JSON object, no markdown, no extra text.
`;

async function init() {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const chat = model.startChat({
        history: [
            {
                role: "user",
                parts: [
                    { text: SYSTEM_PROMPT }
                ]
            },
        ],
    });

    const userQuery = 'What is the weather of delhi and patiala';
    
    await chat.sendMessage(userQuery);
    
    let stepCount = 0;
    const MAX_STEPS = 20;
    
    while(stepCount < MAX_STEPS) {
        stepCount++;
        
        try {
            const res = await chat.sendMessage("");
            const resText = res.response.text().trim();
            
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
            console.log('Error parsing JSON: ', error);
            console.log('Raw response: ', resText);
            
            if (!resText.includes('{') && !resText.includes('}')) {
                console.log('Skipping non-JSON response...');
                break;
            }
            continue;
        }
            
        if(parsed.step === "think") {
            console.log('THINK: ', parsed.content);
            continue;
        } else if(parsed.step === "action") {
            console.log('ACTION: ', parsed.tool, parsed.input);
            const tool = parsed.tool;
            const input = parsed.input;
            console.log('calling tool: ', tool, input);
    
            const toolOutput = toolMap[tool](input);
            console.log('Tool output: ', toolOutput);
            
            await chat.sendMessage(
                JSON.stringify({ step: "observer", content: toolOutput })
            );            
            continue;
        } else if(parsed.step === "observer") {
            console.log('OBSERVER: ', parsed.content);
            continue;
        } else if(parsed.step === "output") {
            console.log('OUTPUT: ', parsed.content);
            break;
        } else {
            console.log('Unknown step: ', parsed.step);
            console.log('Full response: ', parsed);
            break;
        }
        
    } catch (error) {
        if (error.status === 429) {
            console.log('Rate limit hit. Waiting 60 seconds before retrying...');
            await new Promise(resolve => setTimeout(resolve, 60000));
            stepCount--;
            continue;
        } else {
            console.error('Error in chat loop:', error);
            break;
        }
    }
    }
    
    if (stepCount >= MAX_STEPS) {
        console.log('Reached maximum steps limit. Exiting...');
    }
}

init().catch(console.error);