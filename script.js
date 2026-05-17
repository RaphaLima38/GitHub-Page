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
