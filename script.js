const yearSlot = document.getElementById("current-year");
if (yearSlot) {
  yearSlot.textContent = new Date().getFullYear();
}

const copyTriggers = document.querySelectorAll(".copy-email-trigger");

async function copyEmail(trigger) {
  const email = trigger.dataset.email;
  const defaultLabel = trigger.dataset.defaultLabel || trigger.textContent.trim();
  const successLabel = trigger.dataset.successLabel || "Copiado";
  if (!email) return;

  try {
    await navigator.clipboard.writeText(email);
    const strong = trigger.querySelector("strong");

    if (strong) {
      strong.textContent = successLabel;
    } else {
      trigger.textContent = successLabel;
    }

    window.setTimeout(() => {
      if (strong) {
        strong.textContent = email;
      } else {
        trigger.textContent = defaultLabel;
      }
    }, 1800);
  } catch {
    window.prompt("Copie o e-mail:", email);
  }
}

copyTriggers.forEach((trigger) => {
  trigger.addEventListener("click", () => copyEmail(trigger));
});

const navToggle = document.querySelector(".nav-toggle");
if (navToggle) {
  navToggle.addEventListener("click", () => {
    const open = document.body.classList.toggle("nav-open");
    navToggle.setAttribute("aria-expanded", String(open));
  });
}

const revealNodes = document.querySelectorAll("[data-reveal]");
if (revealNodes.length) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.16,
    rootMargin: "0px 0px -40px 0px"
  });

  revealNodes.forEach((node) => observer.observe(node));
}
