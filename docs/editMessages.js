import { ref, update } from "https://www.gstatic.com/firebasejs/9.16.0/firebase-database.js";

export function editMessage(db, messagePath, currentText) {
  const changedText = prompt("Edit your message:", currentText);
  
  if (changedText !== null && changedText.trim() !== "") {
    const messageRef = ref(db, messagePath);
      console.log("EDIT: ",currentText," \nTO:",changedText, "\non",messageRef);

    update(messageRef, {
      message: changedText,
      isEdited: true
    }).catch((error) => console.error("Update failed:", error));
  }
}