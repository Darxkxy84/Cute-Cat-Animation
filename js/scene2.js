// Wrap code in a block scope to prevent global variable pollution
{

    const catSprite = document.getElementById("cat-sprite");
    const dialogueText = document.getElementById("dialogue-text");
    const scene2 = document.getElementById("scene-2");
    const petCountEl = document.getElementById("pet-count");
    const feedCountEl = document.getElementById("feed-count");

    // Global state hook for future cat.js AI integration
    // When cat.js boots up the chat, it can set window.catInteractionEnabled = false;
    window.catInteractionEnabled = true;

    // MODIFIED: Added unique dialogue profiles for each cat.
    // Easily scalable! Just add a new key here when adding a new cat.
    const catAssets = {
        orange: { 
            prefix: "cat1", 
            folder: "cat1",
            dialogues: [
                "Meow! What are we building today?",
                "I'm coding at 200 meows per minute.",
                "Feed me code (and tuna)!",
                "You look so cute {name} 😽!"
            ],
            feedDialogues: ["Nom nom nom! 😋", "Mmm, orange cats love snacks!", "Delicious base-level fuel!"]
        },
        witch: { 
            prefix: "cat2", 
            folder: "witchcat",
            dialogues: [
                "Double, double, toil and trouble... or just coding bugs?",
                "Did you bring any eye of newt, {name}?",
                "Error 404: Spell interrupted.",
                "Stop touching me {name} 😾",
                "Are we cursed?"
            ],
            feedDialogues: ["A magical feast! 🔮", "This brew pleases me.", "Nom... tastes like stardust!"]
        },
        frost: { 
            prefix: "cat3", 
            folder: "frostcat",
            dialogues: [
                "Brrr... stays cool under compilation pressure.",
                "Everything looks frozen from up here!",
                "I wish I could fly like the icy blizzards!",
                "{name}, what cold-blooded programming are we doing today? 😺"
            ],
            feedDialogues: ["Brain freeze! Just kidding, yum! ❄️", "Refreshing!", "Nom nom... frozen treats!"]
        },
        Japanese: { 
            prefix: "cat4", 
            folder: "Japanesecat",
            dialogues: [
                "Konnichiwa! Let's do our best today!",
                "Purr... that tickles! Arigatou!",
                "Can we check GitHub again?",
                "Nyan~ Happy to see you, {name}!"
            ],
            feedDialogues: ["Itadakimasu! 🍣", "Oishii! 🐱", "Thank you for the delicious meal!"]
        },
        Golden: {
            prefix: "cat5",
            folder: "Goldencat",  // Fixed case to match actual assets/Goldencat directory
            dialogues : [
                "Do you wan some money 💰?",
                "Buy me some food {name}!",
                "Thank you, take this gold coin 🪙😼",
                "I am Elon's Cat 💰💸!"
                ],
            feedDialogues: ["Feed me some gold bruda", "Woah! tastes golden...",
                            "Thanks for the treat 😼!", "Pls give me some golden biscuits 🍪🐱..."]
        }
    };
    
    let currentCat = "orange"; // Default active track

    // Helper to dynamically get image paths based on active cat variant
    function getCatAsset(type) {
        const cat = catAssets[currentCat];
        return "assets/" + cat.folder + "/" + cat.prefix + type + ".png";
    }

    // NEW: Helper to get a random dynamic line based on the active cat type
    function getRandomCatDialogue(actionType = "pet") {
        const cat = catAssets[currentCat];
        const pool = actionType === "feed" ? cat.feedDialogues : cat.dialogues;
        
        // Fallback to generic if a specific pool isn't defined yet
        if (!pool || pool.length === 0) return "Meow!";
        
        const name = window.currentUserName || localStorage.getItem("savedUserName") || "Human";
        const randomIndex = Math.floor(Math.random() * pool.length);
        return pool[randomIndex].replace(/{name}/g, name);
    }

    // Counters
    let petCount = 0;
    let feedCount = 0;
    let initialized = false;
    let isFeeding = false;
    let blinkingTimeout = null;
    let happyTimeout = null;

    // 1. Monitor when Scene 2 reveals itself to trigger initial greeting
    const observer = new MutationObserver(() => {
        if (!scene2.classList.contains("hidden") && !initialized) {
            initialized = true;
            startScene2();
        }
    });

    observer.observe(scene2, { attributes: true, attributeFilter: ["class"] });

    function startScene2() {
            // Inside your scene2.js initialization code
        document.body.classList.add('scene-two');

        const name = window.currentUserName || localStorage.getItem("savedUserName") || "Human";
        
        if (name !== "Human") {
            localStorage.setItem("savedUserName", name);
        }
        
        dialogueText.textContent = `Hello, ${name}! Welcome to my world! 🐾`;

        startBlinkingLoop();
        catSprite.addEventListener("click", onCatPet);
        setupFeedingSystem();
        setupCatSelectionSystem(); 
        initKittenBackground();
    }

    // 2. Pet the cat
    function onCatPet() {
        // AI CHAT GUARD: If AI chat is active, prevent standard pet interactions
        if (!window.catInteractionEnabled) return;

        petCount++;
        petCountEl.textContent = petCount;

        if (happyTimeout) clearTimeout(happyTimeout);
        if (blinkingTimeout) clearTimeout(blinkingTimeout);

        catSprite.src = getCatAsset("happy");

        // MODIFIED: Pulled from specific cat dialogue array
        dialogueText.textContent = getRandomCatDialogue("pet");

        happyTimeout = setTimeout(() => {
            catSprite.src = getCatAsset("");
            startBlinkingLoop();
        }, 800);
    }

    // 3. Realistic Cat Blinking Loop
    function startBlinkingLoop() {
        // AI CHAT GUARD: Stops ambient blinking routine if AI chat handles everything
        if (!window.catInteractionEnabled) return;

        function blink() {
            if (!window.catInteractionEnabled) return;
            catSprite.src = getCatAsset("blink");

            setTimeout(() => {
                if (!window.catInteractionEnabled) return;
                catSprite.src = getCatAsset("");
                blinkingTimeout = setTimeout(blink, 2900);
            }, 150);
        }
        blinkingTimeout = setTimeout(blink, 2900);
    }

    // 4. Feeding System
    function setupFeedingSystem() {
        const feedBtn = document.querySelector(".feed-btn");
        if (!feedBtn || !catSprite) return;

        feedBtn.addEventListener("click", (e) => {
            e.stopPropagation(); 

            // AI CHAT GUARD
            if (!window.catInteractionEnabled) return;
            if (isFeeding) return;
            isFeeding = true;

            feedCount++;
            feedCountEl.textContent = feedCount;

            if (blinkingTimeout) clearTimeout(blinkingTimeout);
            if (happyTimeout) clearTimeout(happyTimeout);

            catSprite.src = getCatAsset("eat");
            
            // MODIFIED: Uses cat-specific feeding dialogue
            dialogueText.textContent = getRandomCatDialogue("feed");

            // after feeding animation
            setTimeout(() => {
                // If AI chat gained control mid-feed, don't revert scene text/states
                if (!window.catInteractionEnabled) {
                    isFeeding = false;
                    return;
                }

                catSprite.src = getCatAsset("");
                dialogueText.textContent = "Thanks! That was yummy! 🐱";
                isFeeding = false;
                
                startBlinkingLoop();
            }, 1500);
        });
    }

    // 5. Cat Selection Menu Engine
    function setupCatSelectionSystem() {
        const selectBtn = document.getElementById("select-cat-btn");
        const dropdown = document.getElementById("cat-dropdown");

        selectBtn.addEventListener("click", (e) => {
            if (!window.catInteractionEnabled) return;
            e.stopPropagation();
            dropdown.classList.toggle("hidden");
        });

        dropdown.querySelectorAll(".dropdown-item").forEach(item => {
            item.addEventListener("click", (e) => {
                if (!window.catInteractionEnabled) return;
                currentCat = item.getAttribute("data-cat");
                
                catSprite.src = getCatAsset("");
                dropdown.classList.add("hidden");

                if (blinkingTimeout) clearTimeout(blinkingTimeout);
                if (happyTimeout) clearTimeout(happyTimeout);
                isFeeding = false;
                startBlinkingLoop();
            });
        });

        document.addEventListener("click", () => dropdown.classList.add("hidden"));
    }

    // 5. Scene 2 Background Gradient Animation
    function initKittenBackground() {
        const canvas = document.getElementById("gradient-canvas");
        if (!canvas) return;
        const ctx = canvas.getContext("2d");

        let width = canvas.width = window.innerWidth;
        let height = canvas.height = window.innerHeight;

        window.addEventListener("resize", () => {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        });

        const palette = {
            base: { r: 255, g: 245, b: 246 }, 
            c1: { r: 255, g: 214, b: 220 },   
            c2: { r: 244, g: 232, b: 250 },   
            c3: { r: 224, g: 140, b: 195 }    
        };

        let tick = 0;

        function drawKittenFluid() {
            tick += 0.0012;

            ctx.fillStyle = `rgb(${palette.base.r}, ${palette.base.g}, ${palette.base.b})`;
            ctx.fillRect(0, 0, width, height);

            const x1 = width * 0.5 + Math.sin(tick * 1.1 + 1.5) * (width * 0.2);
            const y1 = height * 0.5 + Math.cos(tick * 0.9 + 0.5) * (height * 0.2);
            const r1 = Math.max(width, height) * 0.75;
            let g1 = ctx.createRadialGradient(x1, y1, 0, x1, y1, r1);
            g1.addColorStop(0, `rgba(${palette.c1.r}, ${palette.c1.g}, ${palette.c1.b}, 0.8)`);
            g1.addColorStop(1, "rgba(255, 255, 255, 0)");
            ctx.fillStyle = g1;
            ctx.fillRect(0, 0, width, height);

            ctx.globalCompositeOperation = "multiply";
            const x2 = width * 0.3 + Math.cos(tick * 0.8) * (width * 0.25);
            const y2 = height * 0.7 + Math.sin(tick * 1.2) * (height * 0.15);
            const r2 = Math.max(width, height) * 0.6;
            let g2 = ctx.createRadialGradient(x2, y2, 0, x2, y2, r2);
            g2.addColorStop(0, `rgba(${palette.c2.r}, ${palette.c2.g}, ${palette.c2.b}, 0.6)`);
            g2.addColorStop(1, "rgba(255, 255, 255, 0)");
            ctx.fillStyle = g2;
            ctx.fillRect(0, 0, width, height);

            ctx.globalCompositeOperation = "screen";
            const x3 = width * 0.7 + Math.sin(tick * 0.9) * (width * 0.2);
            const y3 = height * 0.2 + Math.cos(tick * 1.0) * (height * 0.2);
            const r3 = Math.max(width, height) * 0.55;
            let g3 = ctx.createRadialGradient(x3, y3, 0, x3, y3, r3);
            g3.addColorStop(0, `rgba(${palette.c3.r}, ${palette.c3.g}, ${palette.c3.b}, 0.45)`);
            g3.addColorStop(1, "rgba(255, 255, 255, 0)");
            ctx.fillStyle = g3;
            ctx.fillRect(0, 0, width, height);

            ctx.globalCompositeOperation = "source-over";

            requestAnimationFrame(drawKittenFluid);
        }

        drawKittenFluid();
    }

    
    // Global function to be called by catchat.js when it wants to return control to scene2.js
    window.returnToScene2 = function () {

    const layout = document.querySelector(".scene2-layout");
    const counters = document.querySelector(".counter-bars");
    const feedBtn = document.querySelector(".feed-btn");
    const selector = document.querySelector(".cat-selector-container");
    const chatTrigger = document.getElementById("open-chat-btn");

    layout?.classList.remove("chat-mode-hidden");
    counters?.classList.remove("chat-mode-hidden");
    feedBtn?.classList.remove("chat-mode-hidden");
    selector?.classList.remove("chat-mode-hidden");
    chatTrigger?.classList.remove("chat-mode-hidden");

    window.catInteractionEnabled = true;
};
}
