// main.js
import {
  CLOSE_ICON,
  MESSAGE_ICON,
  CHAT_ICON,
  SEND_ICON,
  styles,
} from "./assets.js";

class MessageWidget {
  constructor(position = "bottom-right", organizationId = 1) {
    this.organizationId = organizationId;
    this.position = this.getPosition(position);
    this.open = false;
    this.initialize();
    this.injectStyles();
    this.chatHistory = [];
  }

  position = "";
  open = false;
  widgetContainer = null;

  getPosition(position) {
    const [vertical, horizontal] = position.split("-");
    return {
      [vertical]: "30px",
      [horizontal]: "30px",
    };
  }

  async initialize() {
    try {
      /**
       * Create and append a div element to the document body
       */
      const container = document.createElement("div");
      container.style.position = "fixed";
      Object.keys(this.position).forEach(
        (key) => (container.style[key] = this.position[key])
      );
      document.body.appendChild(container);

      /**
       * Create a button element and give it a class of button__container
       */
      const buttonContainer = document.createElement("button");
      buttonContainer.classList.add("button__container");

      /**
       * Create a span element for the widget icon, give it a class of `widget__icon`, and update its innerHTML property to an icon that would serve as the widget icon.
       */
      const widgetIconElement = document.createElement("span");
      widgetIconElement.innerHTML = CHAT_ICON;
      widgetIconElement.classList.add("widget__icon");
      this.widgetIcon = widgetIconElement;

      /**
       * Create a span element for the close icon, give it a class of `widget__icon` and `widget__hidden` which would be removed whenever the widget is closed, and update its innerHTML property to an icon that would serve as the widget icon during that state.
       */
      const closeIconElement = document.createElement("span");
      closeIconElement.innerHTML = CLOSE_ICON;
      closeIconElement.classList.add("widget__icon", "widget__hidden");
      this.closeIcon = closeIconElement;

      /**
       * Append both icons created to the button element and add a `click` event listener on the button to toggle the widget open and close.
       */
      buttonContainer.appendChild(this.widgetIcon);
      buttonContainer.appendChild(this.closeIcon);
      buttonContainer.addEventListener("click", this.toggleOpen.bind(this));

      /**
       * Create a container for the widget and add the following classes:- `widget__hidden`, `widget__container`
       */
      this.widgetContainer = document.createElement("div");
      this.widgetContainer.classList.add("widget__hidden", "widget__container");

      /**
       * Invoke the `createWidget()` method
       */
      this.createWidgetContent();

      /**
       * Append the widget's content and the button to the container
       */
      container.appendChild(this.widgetContainer);
      container.appendChild(buttonContainer);

      /**
       * Generate threadId
       */
      const threadId = await this.generateThread();

      // Add event listener for form submission
      const formElement = this.widgetContainer.querySelector("form");
      formElement.addEventListener("submit", (event) =>
        this.sendMessage(event, threadId)
      );
    } catch (error) {
      console.error("Error initializing widget:", error);
    }
  }

  renderChatHistory() {
    this.chatHistory.forEach((entry) => {
      if (entry.type === "user") {
        this.renderUserMessage(entry.message);
      } else if (entry.type === "system") {
        this.renderSystemMessage(entry.message);
      }
    });
  }

  generateThread = async () => {
    try {
      const response = await fetch(
        "https://sentien-rag-app.onrender.com/threads/",
        {
          method: "POST",
          headers: {
            accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            organization_id: this.organizationId, // Use the organizationId from constructor
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to generate thread");
      }

      const data = await response.json();
      console.log(data);

      // Extract thread_id from the JSON response
      const threadId = data.id;

      // Return thread_id
      return threadId;
    } catch (error) {
      console.error("Error:", error);
      return null; // Return null in case of error
    }
  };

  createWidgetContent() {
    // Render textarea
    this.widgetContainer.innerHTML = `
      <div class="chat__container">
        <div class="chat_message system">Hi there! I'm here to assist you.</div>
      </div>
      <form>
        <div class="form__field">
          <label for="message">Message</label>
          <textarea
            id="message"
            name="message"
            placeholder="Enter your message"
            rows="3"
          ></textarea>
        </div>
        <button>Send</button>
      </form>
    `;

    // Check if chat history exists in localStorage
    const storedChatHistory = localStorage.getItem("chatHistory");
    if (storedChatHistory) {
      // If chat history exists, parse and render it
      this.chatHistory = JSON.parse(storedChatHistory);
      this.renderChatHistory();
    }
  }

  async sendMessage(event, threadId) {
    event.preventDefault();

    const formData = new FormData(event.target);
    const message = formData.get("message");

    // Render user's message.
    this.renderUserMessage(message);

    // Reset textarea to empty string
    const messageTextarea = event.target.querySelector("textarea");
    if (messageTextarea) {
      messageTextarea.value = "";
    }

    // Add user's message to chat history
    this.chatHistory.push({ type: "user", message });

    // Save chat history in local storage
    localStorage.setItem("chatHistory", JSON.stringify(this.chatHistory));

    // Disable textarea
    const textarea = event.target.querySelector("textarea");
    if (textarea) {
      textarea.disabled = true;
    }

    console.log({
      organization_id: this.organizationId,
      thread_id: threadId,
      message: message,
    });

    try {
      const response = await fetch(
        "https://sentien-rag-app.onrender.com/chat/",
        {
          method: "POST",
          headers: {
            accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            organization_id: this.organizationId,
            thread_id: threadId,
            message: message,
          }),
        }
      );

      const responseData = await response.json();

      console.log(responseData);

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      // Handle the response asynchronously
      await this.handleResponse(responseData);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      // Re-enable textarea after response handling
      if (textarea) {
        textarea.disabled = false;
      }
    }
  }

  async handleResponse(responseData) {
    // Check if the response contains the expected field
    if (responseData && responseData.response) {
      // Render server response as a system message
      this.renderSystemMessage(responseData.response);

      this.chatHistory.push({ type: "system", message: responseData.response });

      localStorage.setItem("chatHistory", JSON.stringify(this.chatHistory));

      // Scroll to the bottom of the chat container
      const chatContainer =
        this.widgetContainer.querySelector(".chat__container");
      if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    } else {
      throw new Error("Invalid response format");
    }
  }

  renderUserMessage(message) {
    const chatContainer =
      this.widgetContainer.querySelector(".chat__container");
    const userMessageElement = document.createElement("div");
    userMessageElement.classList.add("chat_message", "user");
    userMessageElement.textContent = message;
    chatContainer.appendChild(userMessageElement);
  }

  renderSystemMessage(message) {
    const chatContainer =
      this.widgetContainer.querySelector(".chat__container");
    const systemMessageElement = document.createElement("div");
    systemMessageElement.classList.add("chat_message", "system");
    systemMessageElement.textContent = message;
    chatContainer.appendChild(systemMessageElement);
  }

  injectStyles() {
    const styleTag = document.createElement("style");
    styleTag.innerHTML = styles.replace(/^\s+|\n/gm, "");
    document.head.appendChild(styleTag);
  }

  toggleOpen() {
    this.open = !this.open;
    if (this.open) {
      this.widgetIcon.classList.add("widget__hidden");
      this.closeIcon.classList.remove("widget__hidden");
      this.widgetContainer.classList.remove("widget__hidden");
    } else {
      // Instead of recreating the widget content, just hide the widget
      this.widgetIcon.classList.remove("widget__hidden");
      this.closeIcon.classList.add("widget__hidden");
      this.widgetContainer.classList.add("widget__hidden");
    }
  }
}

function initializeWidget() {
  return new MessageWidget();
}

initializeWidget();
