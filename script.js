const year = document.getElementById("current-year");
if (year) {
  year.textContent = new Date().getFullYear();
}

document.querySelectorAll(".copy-email").forEach((button) => {
  button.addEventListener("click", async () => {
    const email = button.dataset.email;
    if (!email) return;

    try {
      await navigator.clipboard.writeText(email);
      const label = button.querySelector("strong") || button;
      const original = label.textContent;
      label.textContent = "E-mail copiado";
      window.setTimeout(() => {
        label.textContent = original;
      }, 1600);
    } catch {
      window.prompt("Copie o e-mail:", email);
    }
  });
});

const menuButton = document.querySelector(".menu-button");
if (menuButton) {
  menuButton.addEventListener("click", () => {
    const isOpen = document.body.classList.toggle("menu-open");
    menuButton.setAttribute("aria-expanded", String(isOpen));
  });
}

document.querySelectorAll(".main-nav a").forEach((link) => {
  link.addEventListener("click", () => {
    document.body.classList.remove("menu-open");
    menuButton?.setAttribute("aria-expanded", "false");
  });
});

const animated = document.querySelectorAll("[data-animate]");
if (animated.length) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  animated.forEach((element) => observer.observe(element));
}
