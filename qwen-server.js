/**
 * OM QWEN PROXY - STEALTH EDITION
 * Created by OMNSOUR - insta @kyanx7
 */

const express = require('express');
const { addExtra } = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

const puppeteer = addExtra(require('puppeteer'));
puppeteer.use(StealthPlugin());

const app = express();
app.use(express.json()); 

async function askOMQwenStealth(promptText) {
    console.log("-> [OM PROXY] Launching Stealth Browser...");
    const browser = await puppeteer.launch({
        executablePath: '/usr/bin/chromium', 
        headless: true,
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox', 
            '--disable-dev-shm-usage', 
            '--disable-blink-features=AutomationControlled'
        ]
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 }); 

    // --- SECURE COOKIE INJECTION ---
    try {
        if (process.env.QWEN_COOKIES) {
            const cookies = JSON.parse(process.env.QWEN_COOKIES);
            await page.setCookie(...cookies);
            console.log("-> [OM PROXY] 🍪 Cookies Injected Successfully!");
        }
    } catch (err) {
        console.log("-> [OM PROXY] Cookie Error: ", err.message);
    }

    try {
        console.log("-> [OM PROXY] Navigating to Qwen (Temporary Chat)...");
        await page.goto('https://chat.qwen.ai/?temporary-chat=true', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await new Promise(r => setTimeout(r, 6000)); 

        const inputSelector = 'textarea'; 
        await page.waitForSelector(inputSelector, { visible: true, timeout: 15000 });
        
        console.log("-> [OM PROXY] Injecting Task...");
        await page.evaluate((text, selector) => {
            const input = document.querySelector(selector);
            if (input) {
                input.value = text;
                input.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }, promptText, inputSelector);
        
        await page.keyboard.press('Space');
        await new Promise(r => setTimeout(r, 1000)); 
        await page.keyboard.press('Enter');
        
        // ==========================================
        // 🚀 SMART POLLING SCRAPER (120s Timeout)
        // ==========================================
        console.log("-> [OM PROXY] Waiting for AI thinking process to finish...");
        
        let finalAnswer = null;
        let attempts = 0;
        const maxAttempts = 40; // 120 seconds total
        
        while (attempts < maxAttempts) { 
            await new Promise(r => setTimeout(r, 3000)); 
            
            finalAnswer = await page.evaluate(() => {
                const elements = document.querySelectorAll('.markdown-body, .qwen-markdown, .custom-qwen-markdown, div[class*="markdown"]');
                
                for (let i = elements.length - 1; i >= 0; i--) {
                    const text = elements[i].innerText.trim();
                    const isToolUI = text.includes('Skip') || 
                                     text.includes('Running') || 
                                     text.includes('Refining') || 
                                     text.includes('Thinking') || 
                                     text.includes('Searching');
                    
                    if (text && text.length > 20 && !isToolUI) {
                        return text;
                    }
                }
                return null;
            });

            if (finalAnswer) {
                console.log("-> [OM PROXY] Result Detected! Finalizing...");
                await new Promise(r => setTimeout(r, 4000)); 
                
                finalAnswer = await page.evaluate(() => {
                    const elements = document.querySelectorAll('.markdown-body, .qwen-markdown, .custom-qwen-markdown, div[class*="markdown"]');
                    for (let i = elements.length - 1; i >= 0; i--) {
                        const text = elements[i].innerText.trim();
                        const isToolUI = text.includes('Skip') || text.includes('Running') || text.includes('Refining') || text.includes('Thinking') || text.includes('Searching');
                        if (text && text.length > 20 && !isToolUI) return text;
                    }
                    return null;
                });
                break; 
            }
            attempts++;
        }
        // ==========================================

        if (!finalAnswer) {
             console.log("-> [OM PROXY] 📸 Capturing debug screenshot...");
             await page.screenshot({ path: 'debug.png', fullPage: true });
        }

        return finalAnswer ? finalAnswer.trim() : "Error: No response found. Check /debug";

    } catch (error) {
        console.error(`-> [OM PROXY] Browser Crash: ${error.message}`);
        throw error; 
    } finally {
        await browser.close();
        console.log("-> [OM PROXY] Browser closed.\n");
    }
}

// --- API ENDPOINT ---
app.post('/v1/chat/completions', async (req, res) => {
    console.log(`\n[OM PROXY] Incoming Request Received`);
    
    const expectedApiKey = process.env.PROXY_API_KEY;
    if (expectedApiKey) {
        const authHeader = req.headers.authorization;
        if (!authHeader || authHeader !== `Bearer ${expectedApiKey}`) {
            console.warn("-> [OM PROXY] 🛡️ Unauthorized block!");
            return res.status(401).json({ error: { message: "Invalid OM API Key." } });
        }
    }
    
    try {
        const lastMessage = req.body.messages[req.body.messages.length - 1].content;
        const answer = await askOMQwenStealth(lastMessage);
        
        res.json({
            id: "om-" + Math.random().toString(36).substring(2, 15),
            object: "chat.completion",
            created: Math.floor(Date.now() / 1000),
            model: "om-qwen-proxy",
            choices: [{ index: 0, message: { role: "assistant", content: answer }, finish_reason: "stop" }]
        });
        
    } catch (error) {
        res.status(500).json({ error: { message: "OM Proxy internal failure." }});
    }
});

// --- DEBUG VIEW ---
app.get('/debug', (req, res) => {
    const imagePath = path.join(__dirname, 'debug.png');
    if (fs.existsSync(imagePath)) {
        res.sendFile(imagePath);
    } else {
        res.status(404).send("No debug image yet. Run a failing request first!");
    }
});

const PORT = 7860; 
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 OM QWEN PROXY IS LIVE ON PORT ${PORT}!`);
});
