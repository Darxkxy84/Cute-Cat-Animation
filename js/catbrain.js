// ==========================================================
// catbrain.js
// Local context-aware reply engine for Cute Cat Animation.
// No external AI/API is required.
// ==========================================================

(function () {

    "use strict";

    const CatBrain = {};

    CatBrain.memory = {
        previousTopics: [],
        previousReplies: [],
        recentMessages: []
    };

    CatBrain.settings = {
        maximumMemory: 20,
        maximumTopicsPerMessage: 2,
        minimumScore: 1.15,
        contextBoost: 0.45,
        phraseBoost: 2.4,
        exactWordWeight: 1,
        stemWeight: 0.55,
        densityWeight: 1.8,
        recentReplyPenalty: 4
    };

    // Common words are useful for language but poor topic signals.
    const STOP_WORDS = new Set([
        "a","an","the","and","or","but","if","then","than","to","of","for",
        "in","on","at","by","with","from","into","about","as","is","am","are",
        "was","were","be","been","being","do","does","did","can","could",
        "will","would","should","shall","may","might","must","i","me","my",
        "mine","we","us","our","you","your","yours","he","him","his","she",
        "her","they","them","their","it","its","this","that","these","those",
        "what","which","who","whom","whose","where","when","why","how",
        "just","really","very","so","some","any","all","also","please",
        "tell","say","think","thing","things","something","someone","there",
        "here","have","has","had","get","got","getting","make","made","like"
    ]);

    function escapeRegExp(value) {
        return value.replace(/[.*+?^()|[\]\\]/g, "\\$&");
    }

    function normalizeWord(word) {
        let value = String(word || "").toLowerCase();

        value = value
            .replace(/['’]/g, "")
            .replace(/(.)\1{2,}/g, "$1$1")
            .replace(/[^a-z0-9-]/g, "");

        // A deliberately small stemmer: enough to connect common forms
        // without turning unrelated words into the same token.
        if (value.length > 5 && value.endsWith("ies")) {
            value = value.slice(0, -3) + "y";
        } else if (value.length > 5 && value.endsWith("ing")) {
            value = value.slice(0, -3);
        } else if (value.length > 4 && value.endsWith("ed")) {
            value = value.slice(0, -2);
        } else if (value.length > 4 && value.endsWith("es")) {
            value = value.slice(0, -2);
        } else if (value.length > 4 && value.endsWith("s")) {
            value = value.slice(0, -1);
        }

        return value;
    }

    CatBrain.normalize = function (message) {
        return String(message || "")
            .toLowerCase()
            .replace(/['’]/g, "")
            .replace(/(.)\1{2,}/g, "$1$1")
            .replace(/[^a-z0-9?!.\s-]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    };

    CatBrain.tokenize = function (message) {
        return CatBrain.normalize(message)
            .replace(/[?!.]/g, " ")
            .split(" ")
            .map(normalizeWord)
            .filter(Boolean);
    };

    CatBrain.getSignalTokens = function (message) {
        return CatBrain.tokenize(message)
            .filter(token => token.length > 1 && !STOP_WORDS.has(token));
    };

    CatBrain.getPhrases = function (message) {
        const normalized = CatBrain.normalize(message)
            .replace(/[?!.]/g, " ");

        const words = normalized.split(" ").filter(Boolean);
        const phrases = [];

        for (let size = 2; size <= Math.min(5, words.length); size++) {
            for (let i = 0; i <= words.length - size; i++) {
                phrases.push(words.slice(i, i + size).join(" "));
            }
        }

        return phrases;
    };

    CatBrain.countKeywordMatches = function (tokens, keywords) {
        const tokenSet = new Set(tokens);
        return (keywords || []).reduce((count, keyword) => {
            const normalized = normalizeWord(keyword);
            return count + (tokenSet.has(normalized) ? 1 : 0);
        }, 0);
    };

    CatBrain.detectIntent = function (message) {
        const normalized = CatBrain.normalize(message);
        const tokens = CatBrain.getSignalTokens(message);

        const intent = {
            question: /(^|\s)(what|why|how|when|where|who|which|can|could|would|should|is|are|do|does|did)\b/.test(normalized) ||
                normalized.endsWith("?"),
            greeting: /\b(hi|hello|hey|hiya|yo|sup|greetings)\b/.test(normalized),
            farewell: /\b(bye|goodbye|farewell|see you|later|goodnight)\b/.test(normalized),
            excitement: /!{1,}/.test(normalized) ||
                tokens.some(token => ["awesome","amazing","excited","yay","wow"].includes(token)),
            negative: tokens.some(token => [
                "sad","lonely","upset","hurt","worried","scared","angry","stress",
                "stressed","frustrated","cry","crying"
            ].includes(token))
        };

        return intent;
    };

    function phraseMatches(message, phrases) {
        const normalized = CatBrain.normalize(message);
        return (phrases || []).filter(phrase => {
            const clean = CatBrain.normalize(phrase);
            return clean && normalized.includes(clean);
        });
    }

    function topicScore(message, topic, category, index) {
        if (!category || topic === "fallback") return 0;

        const tokens = CatBrain.getSignalTokens(message);
        const tokenSet = new Set(tokens);
        const intent = CatBrain.detectIntent(message);

        const keywords = (category.keywords || []).map(normalizeWord);
        const phrases = category.phrases || [];

        let exact = 0;
        let stem = 0;

        for (const keyword of keywords) {
            if (tokenSet.has(keyword)) {
                exact++;
            } else if (keyword.length > 4) {
                const keywordStem = normalizeWord(keyword);
                if (tokens.some(token => token === keywordStem)) {
                    stem++;
                }
            }
        }

        const matchedPhrases = phraseMatches(message, phrases);
        let score =
            exact * CatBrain.settings.exactWordWeight +
            stem * CatBrain.settings.stemWeight +
            matchedPhrases.length * CatBrain.settings.phraseBoost;

        // Longer messages contain more noise, so reward topic density
        // instead of demanding an arbitrary number of exact matches.
        const signalCount = Math.max(tokens.length, 1);
        const density = Math.min((exact + matchedPhrases.length * 2) / signalCount, 1);
        score += density * CatBrain.settings.densityWeight;

        // Intent-aware boosts prevent generic words from hijacking the topic.
        if (topic === "greeting" && intent.greeting) score += 3;
        if (topic === "goodbye" && intent.farewell) score += 3;
        if (topic === "joke" && /\b(tell me|give me|make me)\b/.test(CatBrain.normalize(message))) score += 1.5;
        if (topic === "sad" && intent.negative) score += 1.5;
        if (topic === "happy" && intent.excitement) score += 1.2;

        // Conversation continuity: a short follow-up can inherit its previous topic.
        const previous = CatBrain.memory.previousTopics.slice(-2);
        if (previous.includes(topic)) score += CatBrain.settings.contextBoost;

        // Category-specific optional related words.
        for (const related of (category.related || [])) {
            if (tokenSet.has(normalizeWord(related))) score += 0.25;
        }

        return score;
    }

    CatBrain.analyzeMessage = function (message) {
        const dictionary = window.CAT_DICTIONARY || {};
        const scored = [];

        for (const topic of Object.keys(dictionary)) {
            const score = topicScore(message, topic, dictionary[topic]);
            if (score >= CatBrain.settings.minimumScore) {
                scored.push({ topic, score });
            }
        }

        scored.sort((a, b) => b.score - a.score);

        const primary = scored[0] || { topic: "fallback", score: 0 };
        const secondary = scored[1];

        // A second topic is only used when it has real evidence and is
        // sufficiently close to the primary topic.
        const topics = [primary];
        if (
            secondary &&
            secondary.topic !== "fallback" &&
            secondary.score >= Math.max(1.8, primary.score * 0.48)
        ) {
            topics.push(secondary);
        }

        return {
            topics: topics.slice(0, CatBrain.settings.maximumTopicsPerMessage),
            allMatches: scored,
            intent: CatBrain.detectIntent(message),
            length: CatBrain.normalize(message).length,
            tokenCount: CatBrain.getSignalTokens(message).length
        };
    };

    CatBrain.detectTopics = function (message) {
        return CatBrain.analyzeMessage(message).topics.map(item => item.topic);
    };

    CatBrain.detectTopic = function (message) {
        return CatBrain.detectTopics(message)[0] || "fallback";
    };

    CatBrain.pickRandomReply = function (array) {
        if (!Array.isArray(array) || array.length === 0) return "Meow.";
        return array[Math.floor(Math.random() * array.length)];
    };

    CatBrain.isRecentReply = function (reply) {
        return CatBrain.memory.previousReplies.includes(reply);
    };

    CatBrain.rememberReply = function (reply) {
        CatBrain.memory.previousReplies.push(reply);
        if (CatBrain.memory.previousReplies.length > CatBrain.settings.maximumMemory) {
            CatBrain.memory.previousReplies.shift();
        }
    };

    CatBrain.rememberMessage = function (message) {
        CatBrain.memory.recentMessages.push(message);
        if (CatBrain.memory.recentMessages.length > CatBrain.settings.maximumMemory) {
            CatBrain.memory.recentMessages.shift();
        }
    };

    CatBrain.rememberTopic = function (topic) {
        if (!topic || topic === "fallback") return;

        CatBrain.memory.previousTopics.push(topic);
        if (CatBrain.memory.previousTopics.length > CatBrain.settings.maximumMemory) {
            CatBrain.memory.previousTopics.shift();
        }
    };

    CatBrain.applyPersonality = function (reply, catType) {
        const personality = window.CAT_PERSONALITIES?.[catType];
        if (!personality) return reply;

        const intro = CatBrain.pickRandomReply(personality.intros || [""]);
        const ending = CatBrain.pickRandomReply(personality.endings || [""]);

        return [intro, reply, ending].filter(Boolean).join(" ").trim();
    };

    CatBrain.getReplyPool = function (topic) {
        const category = window.CAT_DICTIONARY?.[topic];

        if (category && Array.isArray(category.responses)) {
            return category.responses;
        }

        return window.CAT_DICTIONARY?.fallback?.responses || ["Meow."];
    };

    function responseScore(reply, analysis, topic) {
        const replyTokens = new Set(CatBrain.getSignalTokens(reply));
        const category = window.CAT_DICTIONARY?.[topic] || {};
        const topicWords = (category.keywords || []).map(normalizeWord);

        let score = Math.random() * 0.25;

        for (const word of topicWords) {
            if (replyTokens.has(word)) score += 0.3;
        }

        for (const match of analysis.allMatches.slice(0, 3)) {
            if (match.topic === topic) score += match.score * 0.04;
        }

        if (CatBrain.isRecentReply(reply)) {
            score -= CatBrain.settings.recentReplyPenalty;
        }

        return score;
    }

    CatBrain.selectReply = function (topic, analysis = null) {
        const pool = CatBrain.getReplyPool(topic);

        if (pool.length === 1) {
            CatBrain.rememberReply(pool[0]);
            return pool[0];
        }

        const scored = pool
            .map(reply => ({
                reply,
                score: responseScore(reply, analysis || { allMatches: [] }, topic)
            }))
            .sort((a, b) => b.score - a.score);

        // Pick randomly from the strongest few rather than from the entire
        // dictionary. This keeps variety without sacrificing relevance.
        const shortlist = scored.slice(0, Math.min(4, scored.length));
        const selected = CatBrain.pickRandomReply(shortlist).reply;

        CatBrain.rememberReply(selected);
        return selected;
    };

    CatBrain.buildContextReply = function (analysis) {
        const topics = analysis.topics;
        const primary = topics[0]?.topic || "fallback";

        if (primary === "fallback") {
            const previous = CatBrain.memory.previousTopics.slice(-1)[0];
            if (previous && analysis.tokenCount <= 4) {
                return CatBrain.selectReply(previous, analysis);
            }
            return CatBrain.selectReply("fallback", analysis);
        }

        let reply = CatBrain.selectReply(primary, analysis);

        // Multi-topic messages get a small bridge instead of two unrelated
        // full replies smashed together.
        if (topics.length > 1) {
            const secondary = topics[1].topic;
            const secondaryReply = CatBrain.selectReply(secondary, analysis);
            const bridges = window.CAT_DICTIONARY?.meta?.bridges || [
                "And about the other part:",
                "Also,",
                "As for the other bit,"
            ];

            const bridge = CatBrain.pickRandomReply(bridges);
            reply = `${reply} ${bridge} ${secondaryReply}`;
        }

        return reply;
    };

    CatBrain.generateReply = function (message, catType = "orange") {
        CatBrain.rememberMessage(message);

        const analysis = CatBrain.analyzeMessage(message);
        analysis.topics.forEach(item => CatBrain.rememberTopic(item.topic));

        let reply = CatBrain.buildContextReply(analysis);
        reply = CatBrain.applyPersonality(reply, catType);

        return reply;
    };

    CatBrain.getMemory = function () {
        return {
            previousTopics: [...CatBrain.memory.previousTopics],
            previousReplies: [...CatBrain.memory.previousReplies],
            recentMessages: [...CatBrain.memory.recentMessages]
        };
    };

    CatBrain.clearMemory = function () {
        CatBrain.memory.previousTopics = [];
        CatBrain.memory.previousReplies = [];
        CatBrain.memory.recentMessages = [];
    };

    CatBrain.getVersion = function () {
        return "2.0.0";
    };

    CatBrain.detectEmotion = function (message) {
        const intent = CatBrain.detectIntent(message);

        if (intent.negative) return "sad";
        if (intent.excitement) return "excited";
        return "neutral";
    };

    CatBrain.learnWord = function (topic, keyword) {
        const category = window.CAT_DICTIONARY?.[topic];
        if (!category || !keyword) return false;

        category.keywords ||= [];
        const normalized = normalizeWord(keyword);

        if (!category.keywords.some(word => normalizeWord(word) === normalized)) {
            category.keywords.push(keyword);
        }

        return true;
    };

    CatBrain.learnReply = function (topic, reply) {
        const category = window.CAT_DICTIONARY?.[topic];
        if (!category || !reply) return false;

        category.responses ||= [];
        category.responses.push(reply);
        return true;
    };

    CatBrain.exportMemory = function () {
        return JSON.stringify(CatBrain.memory, null, 2);
    };

    window.CatBrain = CatBrain;

})();
