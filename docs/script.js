import { initializeApp } from "https://www.gstatic.com/firebasejs/9.16.0/firebase-app.js";
import { editMessage } from "./editMessages.js";
import {
  getDatabase,
  ref,
  set,
  get,
  onValue,
  runTransaction,
  remove,
  push,
  onChildAdded,
  onChildRemoved,
  update,
} from "https://www.gstatic.com/firebasejs/9.16.0/firebase-database.js"; // <---

// TODO: Add SDKs for Firebase products that you want to use

// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration

const firebaseConfig = {
  databaseURL:
    "https://demo1-3c759-default-rtdb.europe-west1.firebasedatabase.app/", // <----
  apiKey: "AIzaSyDkRmoWLJ0eEXZKYEeUNwRF8V6X0oHwBi0",
  authDomain: "demo1-3c759.firebaseapp.com",
  projectId: "demo1-3c759",
  storageBucket: "demo1-3c759.appspot.com",
  messagingSenderId: "632318648569",
  appId: "1:632318648569:web:60f9813437fa829e598228",
};

const deleteSound = new Audio("./pop.mp3");

const app = initializeApp(firebaseConfig);
const db = getDatabase(app); // <-----
const placementHint = document.getElementById("placement-hint");
const content = document.getElementById("content");
const contentTopMargin = content.style.marginTop;
const messageModal = document.getElementById("message-modal");
const modalSmileyBtn = document.getElementById("modal-smiley-btn");
const modalSubmitBtn = document.getElementById("modal-submit-btn");
const modalCancelBtn = document.getElementById("modal-cancel-btn");
const headerColorInput = document.getElementById("post-it-color");
const weather = document.getElementById("weather-widget");
const body = document.body;
//const introEffectMs = 420;
const splashCleanupMs = 380;

console.log(db);

function hidePlacementHint() {
  if (placementHint) {
    placementHint.classList.add("is-hidden");
  }
}

function sanitizeHtml(input) {
  const temp = document.createElement("div");
  temp.innerHTML = input;

  temp.querySelectorAll("script").forEach((el) => el.remove());

  // Ta bort farliga attribut + autoplay
  temp.querySelectorAll("*").forEach((el) => {
    [...el.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();

      if (name.startsWith("on") || name === "autoplay") {
        el.removeAttribute(attr.name);
      }
    });
  });

  return temp.innerHTML;
}

const nameField = document.getElementById("nameField");
const textField = document.getElementById("textField");
let pendingPlacement = null;
let replyToMessageId = null;
let replyToAuthor = null;
let replyToText = null;

// begränsar längd på texten (Elin)
const max_text_length = 200;
const charCount = document.getElementById("charCount");
textField.addEventListener("input", () => {
  if (textField.value.length > max_text_length) {
    textField.value = textField.value.substring(0, max_text_length);
  }
  // Uppdatera nedräkning
  charCount.textContent = `${textField.value.length} / ${max_text_length}`;

  // Röd färg om texten är nära max
  if (textField.value.length > max_text_length - 20) {
    charCount.style.color = "red";
  } else {
    charCount.style.color = "black";
  }
});

function openMessageModal() {
  messageModal.classList.add("is-open");
  messageModal.setAttribute("aria-hidden", "false");
  textField.focus();
}

function closeMessageModal(resetInput = true) {
  messageModal.classList.remove("is-open");
  messageModal.setAttribute("aria-hidden", "true");
  pendingPlacement = null;

  if (resetInput) {
    textField.value = "";
  }
}

function highlightModalInput() {
  textField.focus();
  textField.style.borderColor = "#d14d72";
  textField.style.boxShadow = "0 0 0 3px rgba(209, 77, 114, 0.18)";

  setTimeout(() => {
    textField.style.borderColor = "";
    textField.style.boxShadow = "";
  }, 900);
}

function getPlacementFromClick(event) {
  const rect = content.getBoundingClientRect();
  const normalizedX = ((event.clientX - rect.left) / rect.width) * 100;
  const normalizedY = ((event.clientY - rect.top) / rect.height) * 100;

  return {
    x: Math.max(0, Math.min(100, Math.round(normalizedX))),
    y: Math.max(0, Math.min(100, Math.round(normalizedY))),
  };
}

function getNormalizedRenderPosition(data) {
  const rect = content.getBoundingClientRect();
  const rawX = Number(data.x) || 0;
  const rawY = Number(data.y) || 0;

  if (data.coordinateSpace === "content-percent") {
    return {
      x: Math.max(0, Math.min(100, rawX)),
      y: Math.max(0, Math.min(100, rawY)),
    };
  }

  const viewportXpx = (rawX / 100) * window.innerWidth;
  const viewportYpx = (rawY / 100) * window.innerHeight;
  const translatedX = ((viewportXpx - rect.left) / rect.width) * 100;
  const translatedY = ((viewportYpx - rect.top) / rect.height) * 100;

  return {
    x: Math.max(0, Math.min(100, translatedX)),
    y: Math.max(0, Math.min(100, translatedY)),
  };
}

function submitMessageAtPendingPosition() {
  if (!pendingPlacement) return;

  const messageValue = textField.value.trim();

  if (messageValue.length === 0) {
    highlightModalInput();
    return;
  }
  const chosenColor = headerColorInput.value;

  push(ref(db, "/messages"), {
    username: "Alrik",
    dateOfCretion: new Date().toString("yyyy-MM-dd hh:mm:ss"),
    message: document.getElementById("uppercaseCheckbox").checked
      ? messageValue.toUpperCase()
      : messageValue,
    author: nameInput,
    color: chosenColor,
    likes: 0,
    dislikes: 0,
    coordinateSpace: "content-percent",
    x: pendingPlacement.x,
    y: pendingPlacement.y,
    replyTo: replyToMessageId || null,
    attributes: {
      italic: document.getElementById("italicCheckbox").checked,
      uppercase: document.getElementById("uppercaseCheckbox").checked,
      bold: document.getElementById("boldCheckbox").checked,
    },
  });

  closeMessageModal(true);
}
// Variation on submitMessageAtPendingPosition but for replies - Emma Persson
function submitReply() {
  const replyText = textField.value.trim();

  if (replyText.length === 0) {
    highlightModalInput();
    return;
  }

  if (!replyToMessageId) return;

  push(ref(db, `/messages/${replyToMessageId}/replies`), {
    author: nameInput,
    message: document.getElementById("uppercaseCheckbox").checked
      ? replyText.toUpperCase()
      : replyText,
    replyTo: replyToAuthor,
    replyPreview: replyToText,
    color: headerColorInput.value,
    likes: 0,
    dislikes: 0,
    attributes: {
      italic: document.getElementById("italicCheckbox").checked,
      uppercase: document.getElementById("uppercaseCheckbox").checked,
      bold: document.getElementById("boldCheckbox").checked,
    },
  });

  textField.value = "";
  replyToMessageId = null;
  replyToAuthor = null;
  replyToText = null;
  closeMessageModal(false);
}
//sparar author
let nameInput = "";
document.getElementById("btn").addEventListener("click", () => {
  nameInput = nameField.value;
  if (nameInput.length > 0) {
    btn.innerText = "Your name:";
    btn.disabled = true;
  }
});

//tömmer fältet när man vill ändra author
nameField.addEventListener("click", () => {
  //nameField.value = "";
  btn.innerText = "submit name";
  btn.disabled = false;
});

//så man kan klicka enter istället för trycka på knappen
function clickBtn() {
  btn.click();
  nameField.blur();
}

nameField.addEventListener("keyup", (event) => {
  if (event.key === "Enter") {
    clickBtn();
  }
});

document.getElementById("delete-all-btn").addEventListener("click", () => {
  if (!confirm("are you sure? ")) return; // David Rhodin
  remove(ref(db, "/"));
});

// Function to increment the like counter
function likeMessage(messageId) {
  const likesRef = ref(db, `/messages/${messageId}/likes`);

  // Use transaction to safely increment likes
  runTransaction(likesRef, (currentLikes) => {
    return (currentLikes || 0) + 1; // Increment likes by 1
  }).catch((error) => {
    console.log("Error updating likes:", error);
  });
}

// Function to increment the dislike counter
function dislikeMessage(messageId) {
  const dislikesRef = ref(db, `/messages/${messageId}/dislikes`);

  // Use transaction to safely increment dislikes
  runTransaction(dislikesRef, (currentDislikes) => {
    return (currentDislikes || 0) + 1; // Increment dislikes by 1
  }).catch((error) => {
    console.log("Error updating dislikes:", error);
  });
}

// Function to determine if text should be black or white based on background color

function getTextColor(bgColor) {
  if (!bgColor || typeof bgColor !== "string" || !bgColor.startsWith("#")) {
    return "black";
  }

  const r = parseInt(bgColor.substr(1, 2), 16);
  const g = parseInt(bgColor.substr(3, 2), 16);
  const b = parseInt(bgColor.substr(5, 2), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 150 ? "black" : "white";
}

modalSmileyBtn.addEventListener("click", () => {
  textField.value += "😊"; // Add smiley emoji to the text field
  textField.focus();
});

modalSubmitBtn.addEventListener("click", () => {
  if (replyToMessageId) {
    submitReply();
  } else {
    submitMessageAtPendingPosition();
  }
});

modalCancelBtn.addEventListener("click", () => {
  closeMessageModal(true);
});

textField.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeMessageModal(true);
  }

  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    submitMessageAtPendingPosition();
  }
});

messageModal.addEventListener("click", (event) => {
  if (event.target === messageModal) {
    closeMessageModal(true);
  }
});

// New Theme Switcher functionality
document
  .getElementById("themeSelector")
  .addEventListener("change", function (event) {
    const selectedTheme = event.target.value;
    switch (selectedTheme) {
      case "dark":
        setDarkMode(body,weather)
        break;
      case "browser":
        setBrowserMode(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches,body,weather)
/*         body.classList.remove("dark-theme", "light-theme");
        if (
          window.matchMedia &&
          window.matchMedia("(prefers-color-scheme: dark)").matches
        )
          body.classList.add("dark-theme", "browser");
        else body.classList.add("light-theme", "browser"); */
        break;
      case "light":
        setLightMode(body,weather)
    }
  });
function setDarkMode(...dom) {
  dom.forEach(element => {
      element.classList.remove("light-theme", "browser");
      element.classList.add("dark-theme");
  });
}
function setLightMode(...dom) {
  dom.forEach(element => {
      element.classList.remove("dark-theme", "browser");
      element.classList.add("light-theme");
  });
}
function setBrowserMode(dark,...dom) {
  dom.forEach(element => {
      element.classList.remove("dark-theme", "light-theme");
      element.classList.add(  (dark?"dark":"light") + "-theme", "browser");
  });
}
content.addEventListener("click", (event) => {
  // Check if the click was on a Like or Dislike button, and handle it separately
  if (event.target && event.target.matches("button[id^='like-btn-']")) {
    const messageId = event.target.id.split("-")[2]; // Extract message ID from button ID
    likeMessage(messageId);
    return;
  }

  if (event.target && event.target.matches("button[id^='dislike-btn-']")) {
    const messageId = event.target.id.split("-")[2]; // Extract message ID from button ID
    dislikeMessage(messageId);
    return;
  }

  if (btn.disabled === true || nameField.value !="") {
    pendingPlacement = getPlacementFromClick(event);
    openMessageModal();
    btn.click()
    btn.innerText = "Your name";
    btn.disabled = true;
  } else {
    alert(
      "Warning! Your post have no author. Please submit a name in the field and confirm.",
    );
    nameField.style.backgroundColor = "red";
    setTimeout(() => {
      nameField.style.backgroundColor = null;
    }, 500);
    setTimeout(() => {
      btn.style.backgroundColor = "red";
    }, 1000);
    setTimeout(() => {
      btn.style.backgroundColor = null;
    }, 1500);
  }
});

function writeUserData() {
  let inputName = document.getElementById("inName").value;
  console.log(inputName);
  set(ref(db, inputName), {
    message: "hello",
    dateOfCretion: new Date(),
  });
}
//writeUserData()

/* onValue(
  ref(db, 'Alrik'),
  (snapshot) => {
    const data = snapshot.val();
    //alert(data.message)
    //document.body.innerHTML= data.message;
  },
  { onlyOnce: true }
); */
onChildAdded(ref(db, "/messages"), (data) => {
  hidePlacementHint();

  let d = data.val();
  const italicClass = d.attributes?.italic ? " italic" : "";
  const boldClass = d.attributes?.bold ? " bold" : "";
  const combinedClasses = `${italicClass}${boldClass}`;
  const messageId = data.key;
  const position = getNormalizedRenderPosition(d);
  // Skyddar användarinput (namn & meddelanden) genom escaping , originaldatan blir orörd i DB / mohammed
  // Fixar <script>-taggar etc. utan att förstöra legitima meddelanden, t.ex. "<3" blir "&#x3C;3"./ mohammed

  // Added - Display quoted message if this is a reply - Emma Persson
  let quoteHTML = "";
  if (d.replyTo) {
    quoteHTML = `
    <div class="reply-quote">
      <span class="reply-label">Replying to:</span>
      <span class="reply-user">${d.replyTo}</span>
      <div class="reply-preview">${d.replyText || ""}</div>
    </div>
  `;
  }

  const messageHTML = sanitizeHtml(
    `<strong>${d.author}:</strong> ${d.message}`,
  );
  const textColor = getTextColor(d.color); // Auto textfärg beroende på bakgrund

  // 💧 Steg 1: Lägg in meddelandet i vattenbubblan
  content.insertAdjacentHTML(
    "beforeend",
    `<div class="bubble-wrapper" id="wrap-${data.key}" style="left:${position.x}%; top:${position.y}%;">
      <div class="bubble-effect" id="effect-${data.key}">
        <div id="msg-${data.key}" style="color:${textColor};">${messageHTML}</div>
      </div>
    </div>`,
  );

  // 💥 Steg 2: Efter intro-animationen – ersätt med riktig bubbla och aktivera all funktionalitet
  setTimeout(() => {
    const wrapper = document.getElementById(`wrap-${data.key}`);
    const msgContent = document.getElementById(`msg-${data.key}`)?.innerHTML;

    if (wrapper && msgContent) {
      wrapper.innerHTML = `
        <div class="splash-explosion"></div>
        <div class="message-container">
    <p class="bubble animate-in${combinedClasses}" id="${data.key}" 
      style="background-color:${d.color}; color:${textColor}; --bubble-color:${d.color};">
      ${quoteHTML}
      <span id="text-content-${messageId}">${msgContent}</span>
      <br/>

      <button id="like-btn-${messageId}" class="emoji-btn subBtn">👍</button>
      <span id="like-count-${messageId}">${d.likes || 0}</span>

      <button id="dislike-btn-${messageId}" class="emoji-btn subBtn">👎</button>
      <span id="dislike-count-${messageId}">${d.dislikes || 0}</span>

      <button id="delete-btn-${messageId}" class="emoji-btn subBtn">🗑️</button>
      <button id="edit-btn-${messageId}" class="emoji-btn subBtn">✏️</button>
      <button id="reply-btn-${messageId}" class="emoji-btn subBtn">🗨️</button>
    </p>

    <div class="replies" id="replies-${messageId}"></div>
  </div>
      `;

      // reply + quote + @mentions- Emma Persson
      document
        .getElementById(`reply-btn-${messageId}`)
        .addEventListener("click", (event) => {
          console.log("Reply button clicked for message ID:", messageId);
          event.stopPropagation();

          replyToMessageId = messageId;
          replyToAuthor = d.author;
          replyToText = d.message;

          // Pre-filled text-input med @mention and quote
          textField.value = "";
          openMessageModal();
        });

      const replyRef = ref(db, `/messages/${messageId}/replies`);
      onChildAdded(replyRef, (replySnap) => {
        const replyData = replySnap.val();
        const replyId = replySnap.key;
        const replyTextColor = getTextColor(replyData.color || d.color);

        const replyContainer = document.getElementById(`replies-${messageId}`);
        if (!replyContainer) return;

        let replyQuoteHTML = "";
        if (replyData.replyTo) {
          replyQuoteHTML = `
            <div class="reply-quote">
              <span class="reply-label">Replying to:</span>
              <span class="reply-user">${replyData.replyTo}</span>
              ${replyData.replyPreview ? `<div class="reply-preview">${replyData.replyPreview}</div>` : ""}
            </div>
          `;
        }
        const replyHTML = sanitizeHtml(`
          <div class="reply-bubble" id="reply-${replyId}" style="background-color:${replyData.color || d.color}; color:${replyTextColor}; --bubble-color:${replyData.color || d.color};">
            ${replyQuoteHTML}
            <div id="reply-text-${replyId}">
              <strong>${replyData.author}</strong>: 
              ${replyData.message.replace(/@(\w+)/g, '<span class="mention">@$1</span>')}
            </div>
            <br/>
            <button id="reply-like-${replyId}" class="emoji-btn subBtn">👍</button>
            <span id="reply-like-count-${replyId}">${replyData.likes || 0}</span>
            <button id="reply-dislike-${replyId}" class="emoji-btn subBtn">👎</button>
            <span id="reply-dislike-count-${replyId}">${replyData.dislikes || 0}</span>
            <button id="reply-delete-${replyId}" class="emoji-btn subBtn">🗑️</button>
            <button id="reply-edit-${replyId}" class="emoji-btn subBtn">✏️</button>
            <button id="reply-reply-${replyId}" class="emoji-btn subBtn">🗨️</button>
          </div>
        `);
        replyContainer.insertAdjacentHTML("beforeend", replyHTML);

        onValue(
          ref(db, `/messages/${messageId}/replies/${replyId}/message`),
          (snap) => {
            const replyTextEl = document.getElementById(
              `reply-text-${replyId}`,
            );
            if (replyTextEl && snap.exists()) {
              replyTextEl.innerHTML = `
              <strong>${replyData.author}</strong>:
              ${snap.val().replace(/@(\w+)/g, '<span class="mention">@$1</span>')}`;
            }
          },
        );
        // LIKE REPLY
        document
          .getElementById(`reply-like-${replyId}`)
          .addEventListener("click", (e) => {
            e.stopPropagation();
            runTransaction(
              ref(db, `/messages/${messageId}/replies/${replyId}/likes`),
              (val) => (val || 0) + 1,
            );
          });
        onValue(
          ref(db, `/messages/${messageId}/replies/${replyId}/likes`),
          (snap) => {
            document.getElementById(`reply-like-count-${replyId}`).textContent =
              snap.val() || 0;
          },
        );
        // DISLIKE REPLY
        document
          .getElementById(`reply-dislike-${replyId}`)
          .addEventListener("click", (e) => {
            e.stopPropagation();
            runTransaction(
              ref(db, `/messages/${messageId}/replies/${replyId}/dislikes`),
              (val) => (val || 0) + 1,
            );
          });
        onValue(
          ref(db, `/messages/${messageId}/replies/${replyId}/dislikes`),
          (snap) => {
            document.getElementById(
              `reply-dislike-count-${replyId}`,
            ).textContent = snap.val() || 0;
          },
        );
        // DELETE REPLY
        document
          .getElementById(`reply-delete-${replyId}`)
          .addEventListener("click", (e) => {
            e.stopPropagation();
            if (confirm("Delete reply?")) {
              remove(ref(db, `/messages/${messageId}/replies/${replyId}`));
            }
          });
        onChildRemoved(ref(db, `/messages/${messageId}/replies`), (snap) => {
          document.getElementById(`reply-${snap.key}`)?.remove();
        });
        // EDIT REPLY
        document
          .getElementById(`reply-edit-${replyId}`)
          .addEventListener("click", (e) => {
            e.stopPropagation();
            editMessage(
              db,
              `/messages/${messageId}/replies/${replyId}`,
              replyData.message,
            );
          });
        // REPLY TO REPLY
        document
          .getElementById(`reply-reply-${replyId}`)
          .addEventListener("click", (e) => {
            e.stopPropagation();
            replyToMessageId = messageId;
            replyToAuthor = replyData.author;
            replyToText = replyData.message;
            textField.value = "";
            openMessageModal();
          });
      });

      // 🔄 Live-uppdatering av meddelandetext (inklusive @-mentions)
      onValue(ref(db, `/messages/${messageId}/message`), (snapshot) => {
        const textSpan = document.querySelector(`#text-content-${messageId}`);
        if (textSpan && snapshot.exists()) {
          textSpan.innerHTML = snapshot.val();
          textSpan.innerHTML = textSpan.innerHTML.replace(
            /@(\w+)/g,
            '<span class="mention">@$1</span>',
          ); // Highlight @mentions (with CSS class "mention")
        }
      });

      // 💨 Ta bort splash-effekten efter animation
      setTimeout(() => {
        wrapper.querySelector(".splash-explosion")?.remove();
      }, splashCleanupMs);

      // 👍 Like-knapp
      document
        .getElementById(`like-btn-${messageId}`)
        ?.addEventListener("click", (event) => {
          event.stopPropagation();
          likeMessage(messageId);
        });

      // 👎 Dislike-knapp
      document
        .getElementById(`dislike-btn-${messageId}`)
        ?.addEventListener("click", (event) => {
          event.stopPropagation();
          dislikeMessage(messageId);
        });

      // 🗑️ Raderings-knapp
      document
        .getElementById(`delete-btn-${messageId}`)
        ?.addEventListener("click", (event) => {
          event.stopPropagation();
          if (confirm("Vill du radera detta meddelande?")) {
            // Spela ljudet om det finns
            deleteSound.currentTime = 0;
            deleteSound.play().catch((err) => console.log(err));

            // Ta bort från Firebase
            remove(ref(db, `/messages/${messageId}`));
          }
        });
      // ✏️ Edit-knapp
      document
        .querySelector(`#edit-btn-${messageId}`)
        ?.addEventListener("click", (event) => {
          event.stopPropagation();
          editMessage(db, `/messages/${messageId}`, d.message);
        });

      // 🔄 Live-uppdatering
      onValue(ref(db, `/messages/${messageId}/likes`), (snapshot) => {
        document.getElementById(`like-count-${messageId}`).textContent =
          snapshot.val() || 0;
      });

      onValue(ref(db, `/messages/${messageId}/dislikes`), (snapshot) => {
        document.getElementById(`dislike-count-${messageId}`).textContent =
          snapshot.val() || 0;
      });

      // 🚫 Inaktivera högerklick
      const bubble = document.getElementById(data.key);
      bubble.addEventListener("contextmenu", (event) => event.preventDefault());

      // 🧼 Radera meddelande vid högerklick
      bubble.addEventListener("mouseup", (event) => {
        if (event.button === 2) {
          if (confirm("Delete message?")) {
            deleteSound.currentTime = 0;
            deleteSound.play().catch((err) => console.log(err));

            bubble.remove();
            remove(ref(db, bubble.id));
          }
        }
      });
    }
  }, 699);
});

// 🧹 Radera bubblan från DOM om den tas bort från Firebase
onChildRemoved(ref(db, "/messages"), (data) => {
  document.querySelector(`#${data.key}`)?.remove();
  document.getElementById(data.key)?.remove();
});

/*
remove(ref(db , 'henrik') ).then(() => {
    console.log("alrik removed");
});*/

//db.ref("-Users/-KUanJA9egwmPsJCxXpv").update({ displayName: "New trainer" });

//update( ref( db, alrik), () =>{ message: "New trainer" } );

//document.getElementById('btn').addEventListener('click', get);

/*
 *
 *   REST API GUIDE FÖR FIREBASE NEDAN |
 *                                     V
 */

// Alriks databas
const BASE_URL =
  "https://demo1-3c759-default-rtdb.europe-west1.firebasedatabase.app/.json";

/* PUT , läggaer till skriver över */
async function putMessage() {
  let messageObject = {
    text: "Hello world put",
    time: new Date(),
  };
  console.log(JSON.stringify(messageObject));
  const requestOptions = {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(messageObject),
  };

  let response = await fetch(BASE_URL, requestOptions);
  let data = await response.json();
  console.log(data);
}

/* PATCH , skriver/uppdaterar men skriver ej över */
async function patchMessage() {
  let messageObject = { text: "Hello world put", time: new Date() };

  const requestOptions = {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(messageObject),
  };

  let response = await fetch(BASE_URL, requestOptions);
  let data = await response.json();
  console.log(data);
}
async function patchMessage2() {
  let messageObject = { firstName: "Alrik", lastName: "HE" };

  const requestOptions = {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(messageObject),
  };

  let response = await fetch(
    "https://demo1-3c759-default-rtdb.europe-west1.firebasedatabase.app/-NoCf2s5SInOIFR3X0VX/.json",
    requestOptions,
  );
  let data = await response.json();
  console.log(data);
}

/* POST */
async function postMessage() {
  let messageObject = { text: "Hello world", time: new Date() };

  const requestOptions = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(messageObject),
  };

  let response = await fetch(BASE_URL, requestOptions);
  let data = await response.json();
  console.log(data);
}

/* GET */
async function getMessages() {
  let response = await fetch(BASE_URL);
  let data = await response.json();
  console.log(data);
}

/* DELETE */
async function deleteMessage() {
  const requestOptions = {
    method: "DELETE",
  };
  let response = await fetch(BASE_URL, requestOptions);
  let data = await response.json();
  console.log(data);
}

// Function to check if the browser is in fullscreen mode
function checkFullscreen() {
  console.log("checking if fullscreen");
  if (
    window.innerHeight == screen.height &&
    window.innerWidth == screen.width
  ) {
    // In fullscreen
    setTimeout(() => {
      document.body.classList.add("fullscreen");
      content.style.marginTop = "unset";
    }, 1000);
  } else {
    // Not in fullscreen
    content.style.marginTop = contentTopMargin;
    document.body.classList.remove("fullscreen");
  }
}

// Check fullscreen status every 10 seconds
// setInterval(checkFullscreen, 10000);

window.addEventListener("resize", checkFullscreen, true);

//---- Color theme ---- //

function saveBackground(color) {
  set(ref(db, "settings/background"), color);
}

function loadBackground() {
  get(ref(db, "settings/background")).then((snapshot) => {
    if (snapshot.exists()) {
      const color = snapshot.val();
      document.body.style.background = snapshot.val();
      colorPicker.value = color;
    }
  });
}

const colorPicker = document.querySelector("#colorPicker");

colorPicker.addEventListener("input", (e) => {
  const color = e.target.value;
  document.body.style.background = color;
  saveBackground(color);
});


// Todays Weather API call - Emma Persson
const weatherApiKey = "eb78d4dd08f0c742513af068fe29e44c";
const malmoLat = 55.6050;
const malmoLon = 13.0038;
const weatherApiUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${malmoLat}&lon=${malmoLon}&appid=${weatherApiKey}&units=metric&lang=sv`;

async function fetchWeather() {
  const weatherEl = document.getElementById('weather-widget');
  if (!weatherEl) return;
  try {
    const response = await fetch(weatherApiUrl);
    if (!response.ok) {
      throw new Error("Network response is not ok");
    }
    const data = await response.json();
    const temp = Math.round(data.main.temp);
    const feelsLike = Math.round(data.main.feels_like);
    const description = data.weather?.[0]?.description ?? "Okänt väder";
    const icon = data.weather?.[0]?.icon ? `https://openweathermap.org/img/wn/${data.weather[0].icon}.png` : "";
    const wind = Math.round(data.wind.speed ?? 0);

   weatherEl.innerHTML = `
    <div class="weather-widget-content">
      ${icon ? `<img src="${icon}" alt="${description}" class="weather-icon">` : ""}

      <div class="weather-text">
        <div class="weather-widget__title">Dagens väder i Malmö</div>
        <div>${description}</div>
        <div>${temp}°C · Känns som ${feelsLike}°C</div>
        <div class="weather-widget__meta">Vind: ${wind} m/s</div>
      </div>
    </div>
  `;
  } catch (error) {
    console.error("Weather API error:", error);
    weatherEl.textContent = "Väderdata kunde inte hämtas.";
    return;
  }
};

window.onload = ()=> {
  loadBackground();
  fetchWeather();
};

// Uppdatera vädret var 10:e minut
setInterval(fetchTodaysWeatherMalmo, 10 * 60 * 1000);

/**
 Automatisk rensning efter 5 minuter
 */
function cleanupOldMessages() {
  const secondsToLive = 600;
  const expirationMs = secondsToLive * 1000;
  const now = Date.now();

  get(ref(db, "/messages"))
    .then((snapshot) => {
      if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
          const data = childSnapshot.val();
          const key = childSnapshot.key;

          if (key === "settings") return;

          const createdAt = new Date(data.dateOfCretion).getTime();

          if (!isNaN(createdAt) && now - createdAt > expirationMs) {
            console.log(`Rensar meddelande efter 10 minuter: ${key}`);
            remove(ref(db, `/messages/${key}`));
          }
        });
      }
    })
    .catch((err) => console.error("Rensningsfel:", err));
}

cleanupOldMessages();

setInterval(cleanupOldMessages, 60000); // check varje minut
