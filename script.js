document.addEventListener("DOMContentLoaded", function () {
    // DOM Elements
    const chatContainer = document.getElementById("chat-container");
    const userInput = document.getElementById("user-input");
    const sendButton = document.getElementById("send-btn");
    const newChatButton = document.getElementById("new-chat-btn");
    const chatHistory = document.getElementById("chat-history");
    const modelSelector = document.getElementById("model-selector");
    const reasoningEffortContainer = document.getElementById(
        "reasoning-effort-container"
    );
    const reasoningEffortSelector = document.getElementById("reasoning-effort");

    // Configure Marked.js
    marked.setOptions({
        breaks: true, // Enable line breaks
        gfm: true, // Enable GitHub Flavored Markdown
        headerIds: false, // Don't add ids to headers
        mangle: false, // Don't mangle email links
    });

    // State
    let chats = [];
    let currentChatId = null;
    let activeChatListener = null; // To keep track of active chat abortController

    // Initialize app
    init();

    function init() {
        // Load chats from localStorage if available
        const savedChats = localStorage.getItem("pollination_chats");
        if (savedChats) {
            chats = JSON.parse(savedChats);
            renderChatHistory();

            // Load the most recent chat if exists
            if (chats.length > 0) {
                switchToChat(chats[chats.length - 1].id);
            }
        } else {
            createNewChat();
        }

        // Set up event listeners
        setupEventListeners();
    }

    function setupEventListeners() {
        // Handle model selection change
        modelSelector.addEventListener("change", function () {
            // Show/hide reasoning effort selector based on model
            if (modelSelector.value === "openai-reasoning") {
                reasoningEffortContainer.style.display = "block";
            } else {
                reasoningEffortContainer.style.display = "none";
            }
        });

        // New chat button
        newChatButton.addEventListener("click", createNewChat);

        // Send message on button click
        sendButton.addEventListener("click", sendMessage);

        // Send message on Enter (but Shift+Enter for new line)
        userInput.addEventListener("keydown", function (e) {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }

            // Auto-resize textarea
            this.style.height = "auto";
            this.style.height = this.scrollHeight + "px";
        });

        // Auto-resize textarea on input
        userInput.addEventListener("input", function () {
            this.style.height = "auto";
            this.style.height = this.scrollHeight + "px";
        });
    }

    function createNewChat() {
        // Cancel any ongoing request
        if (activeChatListener) {
            activeChatListener.abort();
            activeChatListener = null;
        }

        const newChatId = Date.now().toString();
        const newChat = {
            id: newChatId,
            title: "New Chat",
            messages: [],
        };

        chats.push(newChat);
        saveChats();
        renderChatHistory();
        switchToChat(newChatId);
    }

    function switchToChat(chatId) {
        // Cancel any ongoing request
        if (activeChatListener) {
            activeChatListener.abort();
            activeChatListener = null;
        }

        currentChatId = chatId;

        // Update active chat in sidebar
        document.querySelectorAll(".chat-item").forEach((item) => {
            item.classList.remove("active");
            if (item.dataset.id === chatId) {
                item.classList.add("active");
            }
        });

        // Render messages for this chat
        renderChat();
    }

    function renderChatHistory() {
        chatHistory.innerHTML = "";

        // Sort chats to show most recent first
        const sortedChats = [...chats].reverse();

        sortedChats.forEach((chat) => {
            const chatItem = document.createElement("div");
            chatItem.className = "chat-item";
            chatItem.dataset.id = chat.id;
            chatItem.textContent = chat.title;

            if (chat.id === currentChatId) {
                chatItem.classList.add("active");
            }

            chatItem.addEventListener("click", () => switchToChat(chat.id));
            chatHistory.appendChild(chatItem);
        });
    }

    function renderChat() {
        chatContainer.innerHTML = "";

        const currentChat = chats.find((chat) => chat.id === currentChatId);
        if (!currentChat) return;

        if (currentChat.messages.length === 0) {
            // Show welcome message if no messages
            const welcomeDiv = document.createElement("div");
            welcomeDiv.className = "welcome-message";
            welcomeDiv.innerHTML = `
                <h1>AI Chat</h1>
                <p>Made by Ajay Anto</p>
            `;
            chatContainer.appendChild(welcomeDiv);
        } else {
            // Render all messages
            currentChat.messages.forEach((message) => {
                appendMessageToUI(message.role, message.content);
            });
        }

        // Scroll to bottom
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    function appendMessageToUI(role, content) {
        const messageDiv = document.createElement("div");
        messageDiv.className = `message ${role}-message`;

        const messageContent = document.createElement("div");
        messageContent.className = "message-content";

        const roleSpan = document.createElement("div");
        roleSpan.className = "message-role";
        roleSpan.textContent = role === "user" ? "You" : "AI";

        const contentDiv = document.createElement("div");
        contentDiv.className = "message-text";

        // Process content based on role
        if (role === "ai") {
            // Use marked.js to render markdown for AI messages
            // Use DOMPurify to sanitize HTML and prevent XSS
            contentDiv.innerHTML = DOMPurify.sanitize(marked.parse(content));
        } else {
            // For user messages, preserve line breaks but don't render markdown
            contentDiv.textContent = content;
            // Replace newlines with <br> elements
            contentDiv.innerHTML = contentDiv.innerHTML.replace(/\n/g, "<br>");
        }

        messageContent.appendChild(roleSpan);
        messageContent.appendChild(contentDiv);
        messageDiv.appendChild(messageContent);
        chatContainer.appendChild(messageDiv);

        // Scroll to view the new message
        messageDiv.scrollIntoView({ behavior: "smooth" });
    }

    function updateMessageContent(role, content) {
        // Find the last message of the given role and update its content
        const messages = chatContainer.querySelectorAll(`.${role}-message`);
        if (messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            const contentElement = lastMessage.querySelector(
                ".message-content .message-text"
            );
            if (contentElement) {
                if (role === "ai") {
                    // Use marked.js to render markdown for AI messages
                    contentElement.innerHTML = DOMPurify.sanitize(
                        marked.parse(content)
                    );
                } else {
                    contentElement.textContent = content;
                    contentElement.innerHTML = contentElement.innerHTML.replace(
                        /\n/g,
                        "<br>"
                    );
                }
            }
        }
    }

    function addTypingIndicator() {
        const indicatorDiv = document.createElement("div");
        indicatorDiv.className =
            "message ai-message typing-indicator-container";
        indicatorDiv.innerHTML = `
            <div class="message-content">
                <div class="message-role">AI</div>
                <div class="typing-indicator">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            </div>
        `;
        chatContainer.appendChild(indicatorDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
        return indicatorDiv;
    }

    function removeTypingIndicator(indicator) {
        if (indicator && indicator.parentNode) {
            indicator.parentNode.removeChild(indicator);
        }
    }

    async function sendMessage() {
        const message = userInput.value.trim();
        if (!message) return;

        // Get current chat
        const currentChat = chats.find((chat) => chat.id === currentChatId);
        if (!currentChat) return;

        // Add user message to UI
        appendMessageToUI("user", message);

        // Add message to chat
        currentChat.messages.push({
            role: "user",
            content: message,
        });

        // Update chat title if this is the first message
        if (currentChat.messages.length === 1) {
            // Use the first ~20 chars of the message as the chat title
            currentChat.title =
                message.length > 20
                    ? message.substring(0, 20) + "..."
                    : message;
            renderChatHistory();
        }

        // Clear input
        userInput.value = "";
        userInput.style.height = "auto";

        // Save chats
        saveChats();

        // Show typing indicator
        const typingIndicator = addTypingIndicator();

        // Get selected model and options
        const model = modelSelector.value;
        const reasoningEffort =
            model === "openai-reasoning" ? reasoningEffortSelector.value : null;

        // Prepare the request to Pollination API
        const apiUrl = "https://text.pollinations.ai/";
        const controller = new AbortController();
        activeChatListener = controller;

        const requestBody = {
            messages: currentChat.messages.map((msg) => ({
                role: msg.role === "ai" ? "assistant" : msg.role, // Convert 'ai' to 'assistant'
                content: msg.content,
            })),
            model: model,
            stream: true,
        };

        // Add reasoning_effort if applicable
        if (reasoningEffort) {
            requestBody.reasoning_effort = reasoningEffort;
        }

        try {
            const response = await fetch(apiUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal,
            });

            // Remove typing indicator
            removeTypingIndicator(typingIndicator);

            if (!response.ok) {
                throw new Error(
                    `API responded with status: ${response.status}`
                );
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let aiResponse = "";
            let buffer = "";

            // Add AI message placeholder to UI
            appendMessageToUI("ai", "");

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                buffer += chunk;

                // Process complete SSE messages
                const messages = buffer.split("\n\n");
                buffer = messages.pop() || ""; // Keep the incomplete message in the buffer

                for (const message of messages) {
                    if (message.trim()) {
                        const lines = message.split("\n");
                        for (const line of lines) {
                            if (line.startsWith("data: ")) {
                                try {
                                    const jsonStr = line.substring(6); // Remove 'data: ' prefix
                                    const data = JSON.parse(jsonStr);

                                    if (
                                        data.choices &&
                                        data.choices.length > 0 &&
                                        data.choices[0].delta &&
                                        data.choices[0].delta.content
                                    ) {
                                        aiResponse +=
                                            data.choices[0].delta.content;

                                        // Update the AI message in the UI
                                        updateMessageContent("ai", aiResponse);

                                        // Scroll to bottom
                                        chatContainer.scrollTop =
                                            chatContainer.scrollHeight;
                                    }
                                } catch (e) {
                                    console.error("Error parsing JSON:", e);
                                }
                            }
                        }
                    }
                }
            }

            // Add AI response to chat messages
            currentChat.messages.push({
                role: "ai",
                content: aiResponse,
            });

            // Save chats with the AI response
            saveChats();
        } catch (error) {
            // Remove typing indicator
            removeTypingIndicator(typingIndicator);

            // Show error in chat
            if (error.name !== "AbortError") {
                appendMessageToUI("ai", `Error: ${error.message}`);
                console.error("API error:", error);
            }
        } finally {
            activeChatListener = null;
        }
    }

    function saveChats() {
        localStorage.setItem("pollination_chats", JSON.stringify(chats));
    }
});
