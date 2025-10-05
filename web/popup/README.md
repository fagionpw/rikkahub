# Assistant Popup Demo

This lightweight web sandbox demonstrates how to combine a Google Translate style
context-menu shortcut with a Google search widget inspired popup for assistant
interactions.

## Features

- Custom context-menu action that appears when text is selected and lets you
  forward the snippet to the assistant popup.
- Floating popup widget (~420×250 px) with assistant selector, editable text
  input, and a send button that delivers the payload to `/api/assistant/query`.
- Voice capture via the Web Speech API with graceful fallback messaging when the
  browser does not support it.
- Camera capture powered by `getUserMedia()` that converts the frame to Base64
  before sending.
- Inline assistant responses rendered directly below the input field, keeping
  the conversation inside the popup.
- Assistants persisted in `localStorage` so users can maintain their own helper
  catalog.

## Getting Started

Open `index.html` in a modern Chromium-based browser. Highlight any text, use
right-click to choose **Send to assistant**, and the popup will open with the
selected snippet pre-filled. The **Open Assistant Popup** button in the demo area
also shows the widget without relying on the context menu.

By default, the demo mocks API responses when `/api/assistant/query` is
unreachable. Replace the endpoint or adjust `dispatchQuery()` if you have a
backend ready.
