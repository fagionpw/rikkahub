const STORAGE_KEY = "assistant-directory";

function ensureAssistantsSeed() {
  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing) {
    try {
      const parsed = JSON.parse(existing);
      if (Array.isArray(parsed) && parsed.length) {
        return parsed;
      }
    } catch (error) {
      console.warn("Failed to parse assistant directory, reseeding", error);
    }
  }

  const seed = [
    {
      id: "assistant-core",
      name: "Core Assistant",
      description: "Balanced reasoning assistant",
      avatar: "🤖"
    },
    {
      id: "assistant-vision",
      name: "Vision Analyst",
      description: "Understands and explains pictures",
      avatar: "🧠"
    },
    {
      id: "assistant-fast",
      name: "Quick Notes",
      description: "Summaries and translations",
      avatar: "⚡"
    }
  ];

  localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
  return seed;
}

class AssistantPopup extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.assistants = ensureAssistantsSeed();
    this.selectedAssistantId = this.assistants[0]?.id ?? null;
    this.lastInputType = "text";
    this.cameraStream = null;
    this.currentImageData = null;
    this.source = "popup_widget";
  }

  connectedCallback() {
    if (!this.shadowRoot.innerHTML) {
      this.render();
      this.cacheElements();
      this.bindEvents();
      this.populateAssistants();
      this.updateAssistantSummary();
    }
  }

  disconnectedCallback() {
    this.teardownCamera();
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          font-family: inherit;
        }
        .popup {
          position: relative;
          width: 100%;
          max-width: 520px;
          border-radius: var(--popup-radius, 20px);
          background: color-mix(in srgb, Canvas 92%, rgba(255, 255, 255, 0.9));
          backdrop-filter: blur(18px);
          box-shadow: 0 26px 60px rgba(15, 23, 42, 0.28);
          border: 1px solid color-mix(in srgb, CanvasText 8%, transparent);
          display: grid;
          gap: 1rem;
          padding: 1.25rem;
          animation: slide-in 140ms ease-out;
        }

        header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
        }

        .assistant-trigger {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          border: 1px solid color-mix(in srgb, CanvasText 12%, transparent);
          border-radius: 999px;
          padding: 0.6rem 0.9rem;
          background: color-mix(in srgb, Canvas 94%, transparent);
          cursor: pointer;
          transition: border 0.2s ease, transform 0.2s ease;
        }

        .assistant-trigger:hover {
          border-color: color-mix(in srgb, var(--primary, #4285f4) 25%, transparent);
          transform: translateY(-1px);
        }

        .assistant-trigger span.avatar {
          font-size: 1.5rem;
        }

        .assistant-trigger span.meta {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          line-height: 1.1;
        }

        .assistant-trigger span.meta strong {
          font-weight: 600;
        }

        .assistant-trigger span.meta small {
          font-size: 0.75rem;
          color: color-mix(in srgb, CanvasText 60%, transparent);
        }

        .close {
          border: none;
          background: none;
          font-size: 1.2rem;
          cursor: pointer;
          color: color-mix(in srgb, CanvasText 70%, transparent);
        }

        .close:hover {
          color: color-mix(in srgb, CanvasText 100%, transparent);
        }

        .assistant-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          left: 0;
          width: 100%;
          max-height: 260px;
          overflow-y: auto;
          background: color-mix(in srgb, Canvas 96%, rgba(255, 255, 255, 0.95));
          border-radius: 16px;
          border: 1px solid color-mix(in srgb, CanvasText 12%, transparent);
          box-shadow: 0 16px 40px rgba(15, 23, 42, 0.25);
          padding: 0.4rem;
          display: grid;
          gap: 0.25rem;
          z-index: 4;
        }

        .assistant-option {
          display: flex;
          gap: 0.75rem;
          align-items: center;
          border: none;
          background: none;
          cursor: pointer;
          border-radius: 12px;
          padding: 0.55rem 0.75rem;
          transition: background 0.2s ease;
          text-align: left;
        }

        .assistant-option:hover,
        .assistant-option[aria-selected="true"] {
          background: color-mix(in srgb, var(--primary, #4285f4) 12%, transparent);
        }

        .assistant-option span.avatar {
          font-size: 1.35rem;
        }

        .assistant-option span.meta {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .assistant-option span.meta strong {
          font-weight: 600;
        }

        .assistant-option span.meta small {
          font-size: 0.75rem;
          color: color-mix(in srgb, CanvasText 60%, transparent);
        }

        .input-row {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 0.75rem;
          align-items: stretch;
        }

        textarea {
          border: 1px solid color-mix(in srgb, CanvasText 10%, transparent);
          border-radius: 16px;
          padding: 0.75rem 1rem;
          font: inherit;
          min-height: 110px;
          resize: vertical;
          background: color-mix(in srgb, Canvas 98%, rgba(255, 255, 255, 0.96));
          transition: border 0.2s ease, box-shadow 0.2s ease;
        }

        textarea:focus {
          outline: none;
          border-color: color-mix(in srgb, var(--primary, #4285f4) 35%, transparent);
          box-shadow: 0 0 0 4px color-mix(in srgb, var(--primary, #4285f4) 12%, transparent);
        }

        .input-actions {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .icon-button {
          border: 1px solid color-mix(in srgb, CanvasText 12%, transparent);
          border-radius: 16px;
          height: 52px;
          width: 52px;
          background: color-mix(in srgb, Canvas 96%, rgba(255, 255, 255, 0.95));
          cursor: pointer;
          font-size: 1.3rem;
          display: grid;
          place-items: center;
          transition: transform 0.2s ease, border 0.2s ease;
        }

        .icon-button:hover {
          transform: translateY(-1px);
          border-color: color-mix(in srgb, var(--primary, #4285f4) 25%, transparent);
        }

        .footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
        }

        .send-button {
          padding: 0.65rem 1.6rem;
          border-radius: 999px;
          border: none;
          background: linear-gradient(135deg, var(--primary, #4285f4), #7b4dff);
          color: white;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 16px 30px rgba(66, 133, 244, 0.32);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .send-button:hover {
          transform: translateY(-1px);
          box-shadow: 0 18px 36px rgba(66, 133, 244, 0.38);
        }

        .status {
          font-size: 0.8rem;
          color: color-mix(in srgb, CanvasText 60%, transparent);
        }

        .response {
          display: grid;
          gap: 0.5rem;
          border-top: 1px solid color-mix(in srgb, CanvasText 10%, transparent);
          padding-top: 0.75rem;
        }

        .response header {
          display: flex;
          gap: 0.5rem;
          align-items: center;
        }

        .response header strong {
          font-weight: 600;
        }

        .response-content {
          white-space: pre-wrap;
          color: color-mix(in srgb, CanvasText 86%, transparent);
        }

        .attachment-preview {
          border: 1px solid color-mix(in srgb, CanvasText 10%, transparent);
          border-radius: 16px;
          overflow: hidden;
          position: relative;
          max-height: 200px;
        }

        .attachment-preview img {
          width: 100%;
          display: block;
        }

        .attachment-preview button {
          position: absolute;
          top: 10px;
          right: 10px;
          border: none;
          border-radius: 999px;
          padding: 0.35rem 0.6rem;
          cursor: pointer;
          font-size: 0.75rem;
          background: rgba(0, 0, 0, 0.55);
          color: white;
        }

        .overlay {
          position: fixed;
          inset: 0;
          background: rgba(12, 15, 25, 0.55);
          backdrop-filter: blur(6px);
          display: grid;
          place-items: center;
          z-index: 5;
        }

        .camera-modal {
          background: color-mix(in srgb, Canvas 95%, rgba(255, 255, 255, 0.98));
          padding: 1.25rem;
          border-radius: 18px;
          box-shadow: 0 24px 60px rgba(15, 23, 42, 0.35);
          display: grid;
          gap: 1rem;
        }

        .camera-actions {
          display: flex;
          justify-content: space-between;
        }

        video {
          max-width: min(480px, 80vw);
          border-radius: 12px;
          background: black;
        }

        @keyframes slide-in {
          from {
            opacity: 0;
            transform: translateY(10px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      </style>
      <div class="popup">
        <header>
          <button class="assistant-trigger" type="button">
            <span class="avatar"></span>
            <span class="meta">
              <strong></strong>
              <small></small>
            </span>
            <span aria-hidden="true">▾</span>
          </button>
          <button class="close" type="button" title="Close">✕</button>
          <div class="assistant-dropdown" hidden></div>
        </header>
        <div class="attachment-preview" hidden>
          <img alt="Attachment preview" />
          <button type="button" class="remove-attachment">Remove</button>
        </div>
        <div class="input-row">
          <textarea placeholder="Напишите сообщение..." aria-label="Assistant message"></textarea>
          <div class="input-actions">
            <button class="icon-button voice" type="button" title="Voice input">🎤</button>
            <button class="icon-button camera" type="button" title="Capture photo">📷</button>
          </div>
        </div>
        <div class="footer">
          <span class="status"></span>
          <button class="send-button" type="button">Отправить</button>
        </div>
        <section class="response" hidden>
          <header>
            <span class="avatar"></span>
            <strong></strong>
          </header>
          <div class="response-content"></div>
        </section>
      </div>
    `;
  }

  cacheElements() {
    const root = this.shadowRoot;
    this.triggerButton = root.querySelector(".assistant-trigger");
    this.dropdown = root.querySelector(".assistant-dropdown");
    this.closeButton = root.querySelector(".close");
    this.textarea = root.querySelector("textarea");
    this.voiceButton = root.querySelector(".voice");
    this.cameraButton = root.querySelector(".camera");
    this.sendButton = root.querySelector(".send-button");
    this.statusLabel = root.querySelector(".status");
    this.responseSection = root.querySelector(".response");
    this.responseAvatar = this.responseSection.querySelector(".avatar");
    this.responseName = this.responseSection.querySelector("strong");
    this.responseContent = this.responseSection.querySelector(".response-content");
    this.avatar = this.triggerButton.querySelector(".avatar");
    this.assistantName = this.triggerButton.querySelector("strong");
    this.assistantDescription = this.triggerButton.querySelector("small");
    this.attachmentPreview = root.querySelector(".attachment-preview");
    this.attachmentImage = this.attachmentPreview.querySelector("img");
    this.removeAttachmentButton = this.attachmentPreview.querySelector(".remove-attachment");
  }

  bindEvents() {
    this.triggerButton.addEventListener("click", () => this.toggleDropdown());
    this.closeButton.addEventListener("click", () => this.close());
    this.sendButton.addEventListener("click", () => this.handleSend());
    this.voiceButton.addEventListener("click", () => this.handleVoice());
    this.cameraButton.addEventListener("click", () => this.handleCamera());
    this.removeAttachmentButton.addEventListener("click", () => this.clearAttachment());
    this.textarea.addEventListener("input", () => {
      this.lastInputType = "text";
      this.currentImageData = null;
      this.attachmentPreview.hidden = true;
    });
  }

  populateAssistants() {
    this.dropdown.innerHTML = "";
    this.assistants.forEach((assistant) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "assistant-option";
      button.dataset.assistantId = assistant.id;
      button.innerHTML = `
        <span class="avatar">${assistant.avatar ?? "🤖"}</span>
        <span class="meta">
          <strong>${assistant.name}</strong>
          <small>${assistant.description ?? ""}</small>
        </span>
      `;
      if (assistant.id === this.selectedAssistantId) {
        button.setAttribute("aria-selected", "true");
      }
      button.addEventListener("click", () => {
        this.selectedAssistantId = assistant.id;
        this.updateAssistantSummary();
        this.toggleDropdown(false);
      });
      this.dropdown.appendChild(button);
    });
  }

  updateAssistantSummary() {
    const active = this.assistants.find((item) => item.id === this.selectedAssistantId);
    if (!active) {
      return;
    }

    this.avatar.textContent = active.avatar ?? "🤖";
    this.assistantName.textContent = active.name;
    this.assistantDescription.textContent = active.description ?? "";

    Array.from(this.dropdown.children).forEach((node) => {
      if (node instanceof HTMLElement) {
        const selected = node.dataset.assistantId === active.id;
        node.toggleAttribute("aria-selected", selected);
      }
    });
  }

  toggleDropdown(force) {
    const shouldOpen = typeof force === "boolean" ? force : this.dropdown.hasAttribute("hidden");
    this.dropdown.toggleAttribute("hidden", !shouldOpen);
    if (shouldOpen) {
      const onClick = (event) => {
        if (!this.contains(event.target) && !this.shadowRoot.contains(event.target)) {
          this.toggleDropdown(false);
          document.removeEventListener("click", onClick);
        }
      };
      setTimeout(() => document.addEventListener("click", onClick), 0);
    }
  }

  open({ text = "", source = "popup_widget" } = {}) {
    this.hidden = false;
    this.source = source;
    this.textarea.value = text;
    this.lastInputType = text ? "text" : this.lastInputType;
    this.statusLabel.textContent = source === "context_menu" ? "Текст получен из контекстного меню" : "";
    this.responseSection.hidden = true;
    this.clearAttachment();
    this.focusTextarea();
  }

  focusTextarea() {
    requestAnimationFrame(() => {
      this.textarea.focus();
      this.textarea.setSelectionRange(this.textarea.value.length, this.textarea.value.length);
    });
  }

  close() {
    this.hidden = true;
    this.toggleDropdown(false);
    this.teardownCamera();
  }

  async handleSend() {
    if (!this.selectedAssistantId) {
      alert("Выберите ассистента перед отправкой");
      return;
    }

    const content = this.currentImageData ?? this.textarea.value.trim();
    if (!content) {
      alert("Введите сообщение или прикрепите изображение");
      return;
    }

    const payload = {
      assistant_id: this.selectedAssistantId,
      input_type: this.currentImageData ? "image" : this.lastInputType,
      content,
      metadata: {
        timestamp: new Date().toISOString(),
        source: this.source
      }
    };

    this.statusLabel.textContent = "Отправка...";
    this.sendButton.disabled = true;

    try {
      const response = await this.dispatchQuery(payload);
      this.presentResponse(response);
      this.statusLabel.textContent = `Готово • ${new Date().toLocaleTimeString()}`;
    } catch (error) {
      console.error(error);
      this.statusLabel.textContent = "Ошибка при обращении к ассистенту";
    } finally {
      this.sendButton.disabled = false;
    }
  }

  async dispatchQuery(payload) {
    try {
      const response = await fetch("/api/assistant/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        throw new Error(`Assistant API returned ${response.status}`);
      }
      return await response.json();
    } catch (networkError) {
      console.warn("Falling back to mock assistant", networkError);
      return this.mockAssistantResponse(payload);
    }
  }

  async mockAssistantResponse(payload) {
    const assistant = this.assistants.find((item) => item.id === payload.assistant_id);
    return new Promise((resolve) => {
      setTimeout(() => {
        const summary =
          payload.input_type === "image"
            ? "Изображение успешно получено. Я могу описать, что на нём происходит."
            : `Я получил сообщение: "${payload.content.slice(0, 120)}"`;
        resolve({
          assistant_name: assistant?.name ?? "Assistant",
          response: `${summary}\n\n(Это демонстрационный офлайн ответ)`,
          type: "text"
        });
      }, 600);
    });
  }

  presentResponse(response) {
    this.responseSection.hidden = false;
    const active = this.assistants.find((item) => item.id === this.selectedAssistantId);
    this.responseAvatar.textContent = active?.avatar ?? "🤖";
    this.responseName.textContent = response.assistant_name;
    if (response.type === "image") {
      this.responseContent.innerHTML = `<img src="${response.response}" alt="Ответ ассистента" />`;
    } else {
      this.responseContent.textContent = response.response;
    }
  }

  handleVoice() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Web Speech API не поддерживается в этом браузере");
      return;
    }

    const recognizer = new SpeechRecognition();
    recognizer.lang = "ru-RU";
    recognizer.interimResults = false;
    recognizer.maxAlternatives = 1;

    this.statusLabel.textContent = "Слушаю...";
    recognizer.start();

    recognizer.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      this.textarea.value = transcript;
      this.lastInputType = "voice";
      this.statusLabel.textContent = "Голосовой ввод завершён";
    };

    recognizer.onerror = (event) => {
      console.warn("Voice recognition error", event.error);
      this.statusLabel.textContent = "Голосовой ввод не удался";
    };

    recognizer.onend = () => {
      if (this.statusLabel.textContent === "Слушаю...") {
        this.statusLabel.textContent = "Голосовой ввод завершён";
      }
    };
  }

  async handleCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      alert("Камера недоступна в этом браузере");
      return;
    }

    try {
      this.cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
    } catch (error) {
      console.warn("Camera permission denied", error);
      alert("Не удалось получить доступ к камере");
      return;
    }

    const overlay = document.createElement("div");
    overlay.className = "overlay";

    const modal = document.createElement("div");
    modal.className = "camera-modal";

    const video = document.createElement("video");
    video.autoplay = true;
    video.playsInline = true;
    video.srcObject = this.cameraStream;

    const actions = document.createElement("div");
    actions.className = "camera-actions";

    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.textContent = "Отмена";

    const captureButton = document.createElement("button");
    captureButton.type = "button";
    captureButton.textContent = "Сделать фото";

    actions.append(cancelButton, captureButton);
    modal.append(video, actions);
    overlay.append(modal);
    this.shadowRoot.append(overlay);

    const cleanup = () => {
      overlay.remove();
      this.teardownCamera();
    };

    cancelButton.addEventListener("click", cleanup);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        cleanup();
      }
    });

    captureButton.addEventListener("click", () => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL("image/png");
      this.currentImageData = dataUrl;
      this.lastInputType = "image";
      this.showAttachmentPreview(dataUrl);
      cleanup();
      this.statusLabel.textContent = "Фото прикреплено";
    });
  }

  showAttachmentPreview(dataUrl) {
    this.attachmentImage.src = dataUrl;
    this.attachmentPreview.hidden = false;
    this.textarea.value = "";
  }

  clearAttachment() {
    this.currentImageData = null;
    this.attachmentPreview.hidden = true;
    this.attachmentImage.removeAttribute("src");
  }

  teardownCamera() {
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach((track) => track.stop());
      this.cameraStream = null;
    }
  }
}

customElements.define("assistant-popup", AssistantPopup);

const popupElement = document.createElement("assistant-popup");
document.body.appendChild(popupElement);

const openPopupButton = document.getElementById("open-popup");
openPopupButton?.addEventListener("click", () => popupElement.open());

const contextMenu = document.getElementById("assistant-context-menu");
let selectedText = "";

document.addEventListener("contextmenu", (event) => {
  const selection = window.getSelection();
  const text = selection ? selection.toString().trim() : "";
  if (text) {
    event.preventDefault();
    selectedText = text;
    contextMenu.style.left = `${event.pageX}px`;
    contextMenu.style.top = `${event.pageY}px`;
    contextMenu.hidden = false;
  } else {
    contextMenu.hidden = true;
  }
});

document.addEventListener("click", (event) => {
  if (!contextMenu.contains(event.target)) {
    contextMenu.hidden = true;
  }
});

contextMenu.addEventListener("click", (event) => {
  if (!(event.target instanceof HTMLElement)) {
    return;
  }
  if (event.target.dataset.action === "open-popup") {
    popupElement.open({ text: selectedText, source: "context_menu" });
    contextMenu.hidden = true;
  }
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !popupElement.hidden) {
    popupElement.close();
  }
});
