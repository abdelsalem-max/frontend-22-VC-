document.getElementById("fetch").addEventListener("click"), function () {
  fetch("https://dog.ceo/api/breeds/image/random")
    .then(res => res.json())
    .then(data => {
      document.getElementById("dogImage").src = data.message;
    });
};