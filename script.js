const storageKeys = {
  session: "good-drive-session",
  subscriberScores: "good-drive-subscriber-scores",
  subscriberSettings: "good-drive-subscriber-settings",
  subscriptionStatus: "good-drive-subscription-status",
  winnerClaim: "good-drive-winner-claim",
  drawState: "good-drive-draw-state",
};

const defaultScores = [
  { date: "2026-03-20", score: 12 },
  { date: "2026-03-16", score: 18 },
  { date: "2026-03-13", score: 23 },
  { date: "2026-03-08", score: 33 },
  { date: "2026-03-01", score: 41 },
];

const defaultSubscriberSettings = {
  charity: "First Swing Futures",
  contribution: 20,
  cadence: "Monthly",
};

const defaultSubscriptionStatus = {
  status: "active",
  renewalDate: "2026-04-01",
  cancellationStatus: "Not scheduled",
};

const defaultWinnerClaim = {
  status: "payout_in_process",
  proofStatus: "Pending review",
  totalWon: 3350,
  matchedNumbers: [12, 18, 23],
  drawsEntered: 7,
  upcomingDraw: "April 2026",
};

const defaultDrawState = {
  mode: "random",
  simulations: 7,
  published: true,
  publishedMonth: "March 2026",
  lastNumbers: [12, 18, 23, 31, 44],
  prizePool: 134000,
  charityTotal: 82700,
  totalUsers: 1284,
  reviewStatus: "3 pending",
};

const sampleSubscriberPool = [
  { name: "Samira Khan", scores: () => getSubscriberScores().map((entry) => entry.score) },
  { name: "Owen Bailey", scores: () => [8, 18, 23, 31, 44] },
  { name: "Meera Nair", scores: () => [7, 14, 19, 29, 37] },
  { name: "Arjun Rao", scores: () => [10, 18, 22, 31, 41] },
  { name: "Nisha Patel", scores: () => [12, 15, 23, 30, 44] },
];

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getSession() {
  return readJson(storageKeys.session, null);
}

function setSession(session) {
  writeJson(storageKeys.session, session);
}

function clearSession() {
  localStorage.removeItem(storageKeys.session);
}

function getSubscriberScores() {
  return readJson(storageKeys.subscriberScores, defaultScores);
}

function setSubscriberScores(scores) {
  writeJson(storageKeys.subscriberScores, scores);
}

function getSubscriberSettings() {
  return readJson(storageKeys.subscriberSettings, defaultSubscriberSettings);
}

function setSubscriberSettings(settings) {
  writeJson(storageKeys.subscriberSettings, settings);
}

function getSubscriptionStatus() {
  return readJson(storageKeys.subscriptionStatus, defaultSubscriptionStatus);
}

function setSubscriptionStatus(status) {
  writeJson(storageKeys.subscriptionStatus, status);
}

function getWinnerClaim() {
  return readJson(storageKeys.winnerClaim, defaultWinnerClaim);
}

function setWinnerClaim(claim) {
  writeJson(storageKeys.winnerClaim, claim);
}

function getDrawState() {
  return readJson(storageKeys.drawState, defaultDrawState);
}

function setDrawState(drawState) {
  writeJson(storageKeys.drawState, drawState);
}

const navToggle = document.getElementById("navToggle");
const siteNav = document.getElementById("siteNav");
const logoutLinks = document.querySelectorAll("[data-logout]");

logoutLinks.forEach((link) => {
  link.addEventListener("click", () => {
    clearSession();
  });
});

if (navToggle && siteNav) {
  navToggle.addEventListener("click", () => {
    const isOpen = siteNav.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });

  siteNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      siteNav.classList.remove("is-open");
      navToggle.setAttribute("aria-expanded", "false");
    });
  });
}

const flowButtons = document.querySelectorAll("[data-flow-target]");
const flowPanels = document.querySelectorAll(".flow-panel");

flowButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const target = button.getAttribute("data-flow-target");
    flowButtons.forEach((item) => item.classList.remove("is-active"));
    flowPanels.forEach((panel) => panel.classList.remove("is-active"));
    button.classList.add("is-active");
    document.getElementById(target)?.classList.add("is-active");
  });
});

const monthlyBase = { 10: 4900, 15: 5150, 20: 5400, 25: 5650, 30: 5900 };
const yearlyBase = { 10: 49900, 15: 51400, 20: 52900, 25: 54400, 30: 55900 };

const tierInput = document.getElementById("charityTier");
const tierValue = document.getElementById("tierValue");
const monthlyPrice = document.getElementById("monthlyPrice");
const yearlyPrice = document.getElementById("yearlyPrice");
const cadenceButtons = document.querySelectorAll("[data-cadence]");

const formatINR = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

function syncPricing() {
  const tier = Number(tierInput?.value || 20);

  if (tierValue) tierValue.textContent = String(tier);
  if (monthlyPrice) monthlyPrice.textContent = formatINR(monthlyBase[tier]);
  if (yearlyPrice) yearlyPrice.textContent = formatINR(yearlyBase[tier]);
}

if (tierInput) {
  tierInput.addEventListener("input", syncPricing);
  syncPricing();
}

cadenceButtons.forEach((button) => {
  button.addEventListener("click", () => {
    cadenceButtons.forEach((item) => item.classList.remove("is-active"));
    button.classList.add("is-active");
    const cadence = button.getAttribute("data-cadence");
    document.querySelector("#plans")?.scrollIntoView({ behavior: "smooth", block: "start" });

    if (cadence === "yearly") {
      document.querySelector(".plan-card-highlight .button")?.focus();
    } else {
      document.querySelector('[data-plan="momentum"] .button')?.focus();
    }
  });
});

const filterButtons = document.querySelectorAll(".filter-chip");
const charityCards = document.querySelectorAll(".charity-card");
const charitySearch = document.getElementById("charitySearch");

function applyCharityFilters(category = document.querySelector(".filter-chip.is-active")?.getAttribute("data-category") || "all") {
  const query = charitySearch?.value.trim().toLowerCase() || "";

  charityCards.forEach((card) => {
    const matchesCategory = category === "all" || card.getAttribute("data-category") === category;
    const text = card.textContent?.toLowerCase() || "";
    const matchesSearch = query === "" || text.includes(query);
    card.classList.toggle("is-hidden", !(matchesCategory && matchesSearch));
  });
}

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const category = button.getAttribute("data-category");
    filterButtons.forEach((item) => item.classList.remove("is-active"));
    button.classList.add("is-active");
    applyCharityFilters(category);
  });
});

charitySearch?.addEventListener("input", () => {
  applyCharityFilters();
});

const simulateButton = document.getElementById("simulateDraw");
const drawNumbers = document.getElementById("drawNumbers");
const drawResult = document.getElementById("drawResult");
const playerValues = [12, 18, 23, 33, 41];

function formatMoney(value) {
  return formatINR(value);
}

function generateDrawNumbers() {
  const values = new Set();
  while (values.size < 5) {
    values.add(Math.floor(Math.random() * 45) + 1);
  }
  return [...values].sort((a, b) => a - b);
}

function renderDraw() {
  const values = generateDrawNumbers();
  const matches = values.filter((value) => playerValues.includes(value));
  const prizeMap = {
    5: "5-match tier · 40% pool share",
    4: "4-match tier · 35% pool share",
    3: "3-match tier · 25% pool share",
  };

  if (drawNumbers) {
    drawNumbers.innerHTML = values
      .map((value) => `<span>${String(value).padStart(2, "0")}</span>`)
      .join("");
  }

  if (!drawResult) return;

  if (matches.length >= 3) {
    drawResult.innerHTML = `
      <strong>${prizeMap[matches.length]}</strong>
      <p>You matched ${matches.length} number${matches.length > 1 ? "s" : ""}: ${matches.join(", ")}.</p>
    `;
  } else {
    drawResult.innerHTML = `
      <strong>No winning tier this round</strong>
      <p>You matched ${matches.length} number${matches.length !== 1 ? "s" : ""}. Three matches are needed to enter the payout tiers.</p>
    `;
  }
}

simulateButton?.addEventListener("click", renderDraw);

const authModeButtons = document.querySelectorAll("[data-auth-mode]");
const authForm = document.getElementById("authForm");
const signupFields = document.querySelectorAll("[data-signup-field]");
const roleSelect = document.getElementById("roleSelect");
const authHint = document.getElementById("authHint");
const credentialButtons = document.querySelectorAll("[data-fill-credentials]");

credentialButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const emailInput = authForm?.querySelector('input[name="email"]');
    const passwordInput = authForm?.querySelector('input[name="password"]');
    const nameInput = authForm?.querySelector('input[name="name"]');
    const target = button.getAttribute("data-fill-credentials");

    if (!emailInput || !passwordInput || !roleSelect) return;

    if (target === "admin") {
      emailInput.value = "admin@gooddrive.club";
      passwordInput.value = "Admin@2026";
      roleSelect.value = "admin";
      if (nameInput) nameInput.value = "Ava Hart";
    } else {
      emailInput.value = "player@gooddrive.club";
      passwordInput.value = "Player@2026";
      roleSelect.value = "user";
      if (nameInput) nameInput.value = "Samira Khan";
    }

    roleSelect.dispatchEvent(new Event("change"));
  });
});

function syncAuthMode(mode) {
  authModeButtons.forEach((button) => {
    button.classList.toggle("is-active", button.getAttribute("data-auth-mode") === mode);
  });

  signupFields.forEach((field) => {
    field.closest("label")?.classList.toggle("is-hidden", mode !== "signup");
  });
}

authModeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    syncAuthMode(button.getAttribute("data-auth-mode"));
  });
});

roleSelect?.addEventListener("change", () => {
  if (!authHint) return;
  authHint.textContent =
    roleSelect.value === "admin"
      ? "Login as an administrator to open the admin dashboard."
      : "Login as a registered subscriber to open the subscriber dashboard.";
});

authForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const role = roleSelect?.value || "user";
  const email = authForm?.querySelector('input[name="email"]')?.value || "";
  const name =
    authForm?.querySelector('input[name="name"]')?.value ||
    (role === "admin" ? "Ava Hart" : "Samira Khan");

  setSession({
    role,
    email,
    name,
  });

  window.location.href = role === "admin" ? "./admin-dashboard.html" : "./user-dashboard.html";
});

if (authModeButtons.length > 0) {
  syncAuthMode("login");
}

const pageRole = document.body?.dataset.pageRole;
const currentSession = getSession();

if (pageRole === "user" && currentSession?.role !== "user") {
  window.location.href = "./auth.html";
}

if (pageRole === "admin" && currentSession?.role !== "admin") {
  window.location.href = "./auth.html";
}

const subscriberName = document.getElementById("subscriberName");
if (subscriberName && currentSession?.name) {
  subscriberName.textContent = currentSession.name.split(" ")[0];
}

const scoreInput = document.getElementById("scoreInput");
const scoreDateInput = document.getElementById("scoreDateInput");
const saveScoreButton = document.getElementById("saveScoreButton");
const editableScoreList = document.getElementById("editableScoreList");
const scoreBallsList = document.getElementById("scoreBallsList");
const scoreFeedback = document.getElementById("scoreFeedback");
const updatePreferencesButton = document.getElementById("updatePreferencesButton");
const manageBillingButton = document.getElementById("manageBillingButton");
const charitySelect = document.getElementById("charitySelect");
const contributionSelect = document.getElementById("contributionSelect");
const billingCadenceSelect = document.getElementById("billingCadenceSelect");
const selectedCharityValue = document.getElementById("selectedCharityValue");
const contributionTierValue = document.getElementById("contributionTierValue");
const billingCadenceValue = document.getElementById("billingCadenceValue");
const preferencesFeedback = document.getElementById("preferencesFeedback");
const subscriptionStatusSelect = document.getElementById("subscriptionStatusSelect");
const applySubscriptionStatusButton = document.getElementById("applySubscriptionStatusButton");
const subscriptionStatusValue = document.getElementById("subscriptionStatusValue");
const subscriptionStatusMeta = document.getElementById("subscriptionStatusMeta");
const subscriptionStateDetail = document.getElementById("subscriptionStateDetail");
const renewalDateDetail = document.getElementById("renewalDateDetail");
const cancellationStatusDetail = document.getElementById("cancellationStatusDetail");
const subscriptionStateSummaryValue = document.getElementById("subscriptionStateSummaryValue");
const participationMeta = document.getElementById("participationMeta");
const drawsEnteredValue = document.getElementById("drawsEnteredValue");
const upcomingDrawValue = document.getElementById("upcomingDrawValue");
const eligibilityValue = document.getElementById("eligibilityValue");
const scoreSetValidityValue = document.getElementById("scoreSetValidityValue");
const winningsTotalValue = document.getElementById("winningsTotalValue");
const winningsDetailValue = document.getElementById("winningsDetailValue");
const paymentStatusMeta = document.getElementById("paymentStatusMeta");
const paymentStatusValue = document.getElementById("paymentStatusValue");
const matchedNumbersValue = document.getElementById("matchedNumbersValue");
const chooseScreenshotButton = document.getElementById("chooseScreenshotButton");
const uploadProofButton = document.getElementById("uploadProofButton");
const proofStatusButton = document.getElementById("proofStatusButton");
const proofFeedback = document.getElementById("proofFeedback");

const drawLogicSelect = document.getElementById("drawLogicSelect");
const adminDrawNumbers = document.getElementById("adminDrawNumbers");
const runSimulationButton = document.getElementById("runSimulationButton");
const publishDrawButton = document.getElementById("publishDrawButton");
const drawFeedback = document.getElementById("drawFeedback");
const adminPrizePoolValue = document.getElementById("adminPrizePoolValue");
const adminPrizePoolMeta = document.getElementById("adminPrizePoolMeta");
const adminCharityTotalValue = document.getElementById("adminCharityTotalValue");
const adminCharityMeta = document.getElementById("adminCharityMeta");
const adminTotalUsersValue = document.getElementById("adminTotalUsersValue");
const adminUsersMeta = document.getElementById("adminUsersMeta");
const approveProofButton = document.getElementById("approveProofButton");
const rejectProofButton = document.getElementById("rejectProofButton");
const markPaidButton = document.getElementById("markPaidButton");
const winnersFeedback = document.getElementById("winnersFeedback");
const openProfilesButton = document.getElementById("openProfilesButton");
const manageSubscriptionsButton = document.getElementById("manageSubscriptionsButton");
const adminUserFeedback = document.getElementById("adminUserFeedback");
const editCharitiesButton = document.getElementById("editCharitiesButton");
const manageMediaButton = document.getElementById("manageMediaButton");
const adminCharityFeedback = document.getElementById("adminCharityFeedback");

function formatDateLabel(dateValue) {
  const date = new Date(`${dateValue}T00:00:00`);
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function humanizeSubscriptionStatus(status) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getWeightedDrawNumbers() {
  const frequencyMap = new Map();
  sampleSubscriberPool.forEach((subscriber) => {
    subscriber.scores().forEach((score) => {
      frequencyMap.set(score, (frequencyMap.get(score) || 0) + 1);
    });
  });

  return [...frequencyMap.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, 5)
    .map(([score]) => score)
    .sort((a, b) => a - b);
}

function getDrawNumbersByMode(mode) {
  return mode === "algorithmic" ? getWeightedDrawNumbers() : generateDrawNumbers();
}

function calculateDrawResults(numbers, prizePool) {
  const tiers = {
    5: Math.round(prizePool * 0.4),
    4: Math.round(prizePool * 0.35),
    3: Math.round(prizePool * 0.25),
  };

  const winners = sampleSubscriberPool
    .map((subscriber) => {
      const scores = subscriber.scores();
      const matches = numbers.filter((value) => scores.includes(value));
      return {
        name: subscriber.name,
        matches,
        count: matches.length,
      };
    })
    .filter((subscriber) => subscriber.count >= 3);

  const grouped = {
    5: winners.filter((winner) => winner.count === 5),
    4: winners.filter((winner) => winner.count === 4),
    3: winners.filter((winner) => winner.count === 3),
  };

  return {
    grouped,
    payoutByTier: {
      5: grouped[5].length ? Math.round(tiers[5] / grouped[5].length) : 0,
      4: grouped[4].length ? Math.round(tiers[4] / grouped[4].length) : 0,
      3: grouped[3].length ? Math.round(tiers[3] / grouped[3].length) : 0,
    },
    rollover: grouped[5].length === 0 ? tiers[5] : 0,
  };
}

function applyRestrictedMode(isRestricted) {
  [
    saveScoreButton,
    updatePreferencesButton,
    manageBillingButton,
    chooseScreenshotButton,
    uploadProofButton,
  ].forEach((button) => {
    if (!button) return;
    button.disabled = isRestricted;
  });

  [scoreInput, scoreDateInput, charitySelect, contributionSelect, billingCadenceSelect].forEach((field) => {
    if (!field) return;
    field.disabled = isRestricted;
  });
}

function renderSubscriptionState() {
  const subscription = getSubscriptionStatus();
  const settings = getSubscriberSettings();
  const isRestricted = subscription.status === "inactive" || subscription.status === "lapsed";
  const stateLabel = humanizeSubscriptionStatus(subscription.status);

  if (subscriptionStatusSelect) {
    subscriptionStatusSelect.value = subscription.status;
  }
  if (subscriptionStatusValue) {
    subscriptionStatusValue.textContent = stateLabel;
  }
  if (subscriptionStatusMeta) {
    subscriptionStatusMeta.textContent = `${settings.cadence} plan · renewal date ${formatDateLabel(subscription.renewalDate)}`;
  }
  if (subscriptionStateDetail) {
    subscriptionStateDetail.textContent = stateLabel;
  }
  if (renewalDateDetail) {
    renewalDateDetail.textContent = formatDateLabel(subscription.renewalDate);
  }
  if (cancellationStatusDetail) {
    cancellationStatusDetail.textContent = subscription.cancellationStatus;
  }
  if (subscriptionStateSummaryValue) {
    subscriptionStateSummaryValue.textContent = stateLabel;
  }
  if (eligibilityValue) {
    eligibilityValue.textContent = isRestricted ? "Restricted" : "Confirmed";
  }
  if (scoreSetValidityValue) {
    scoreSetValidityValue.textContent = isRestricted ? "Locked" : "Valid";
  }
  if (participationMeta) {
    participationMeta.textContent = isRestricted
      ? "Upcoming draw · restricted until subscription is reactivated"
      : `Upcoming draw · ${getWinnerClaim().drawsEntered} draws entered`;
  }

  applyRestrictedMode(isRestricted);
}

function renderSubscriberSettings() {
  const settings = getSubscriberSettings();
  if (charitySelect) charitySelect.value = settings.charity;
  if (contributionSelect) contributionSelect.value = String(settings.contribution);
  if (billingCadenceSelect) billingCadenceSelect.value = settings.cadence;
  if (selectedCharityValue) selectedCharityValue.textContent = settings.charity;
  if (contributionTierValue) contributionTierValue.textContent = `${settings.contribution}%`;
  if (billingCadenceValue) billingCadenceValue.textContent = settings.cadence;
}

function renderWinnerClaim() {
  const claim = getWinnerClaim();
  if (winningsTotalValue) winningsTotalValue.textContent = formatMoney(claim.totalWon);
  if (winningsDetailValue) winningsDetailValue.textContent = formatMoney(claim.totalWon);
  if (paymentStatusMeta) paymentStatusMeta.textContent = `Current payment status: ${claim.status.replaceAll("_", " ")}`;
  if (paymentStatusValue) paymentStatusValue.textContent = claim.status.replaceAll("_", " ");
  if (matchedNumbersValue) matchedNumbersValue.textContent = claim.matchedNumbers.join(", ");
  if (proofStatusButton) proofStatusButton.textContent = claim.proofStatus;
  if (drawsEnteredValue) drawsEnteredValue.textContent = String(claim.drawsEntered);
  if (upcomingDrawValue) upcomingDrawValue.textContent = claim.upcomingDraw;
}

function renderAdminDrawState() {
  const drawState = getDrawState();
  if (drawLogicSelect) drawLogicSelect.value = drawState.mode;
  if (adminDrawNumbers) {
    adminDrawNumbers.innerHTML = drawState.lastNumbers.map((value) => `<span>${value}</span>`).join("");
  }
  if (adminPrizePoolValue) adminPrizePoolValue.textContent = formatMoney(drawState.prizePool);
  if (adminPrizePoolMeta) {
    adminPrizePoolMeta.textContent = drawState.published
      ? `Published for ${drawState.publishedMonth}`
      : "Simulation only";
  }
  if (adminCharityTotalValue) adminCharityTotalValue.textContent = formatMoney(drawState.charityTotal);
  if (adminCharityMeta) adminCharityMeta.textContent = `Current month allocation · ${drawState.mode} logic`;
  if (adminTotalUsersValue) adminTotalUsersValue.textContent = drawState.totalUsers.toLocaleString("en-IN");
  if (adminUsersMeta) adminUsersMeta.textContent = `${getDrawState().reviewStatus} · ${drawState.simulations} simulations this month`;
}

function renderSubscriberScores() {
  if (!editableScoreList || !scoreBallsList) return;
  const scores = getSubscriberScores()
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  editableScoreList.innerHTML = scores
    .map(
      (entry, index) => `
        <div class="score-edit-row">
          <span>${formatDateLabel(entry.date)}</span>
          <input type="number" value="${entry.score}" min="1" max="45" data-score-index="${index}" />
          <button class="button button-ghost button-small" type="button" data-update-score="${index}">Edit</button>
        </div>
      `,
    )
    .join("");

  scoreBallsList.innerHTML = scores.map((entry) => `<span>${entry.score}</span>`).join("");

  editableScoreList.querySelectorAll("[data-update-score]").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.getAttribute("data-update-score"));
      const input = editableScoreList.querySelector(`[data-score-index="${index}"]`);
      const nextScore = Number(input?.value);
      const nextScores = getSubscriberScores().slice().sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

      if (!Number.isFinite(nextScore) || nextScore < 1 || nextScore > 45) {
        if (scoreFeedback) scoreFeedback.textContent = "Score must stay between 1 and 45.";
        return;
      }

      nextScores[index].score = nextScore;
      setSubscriberScores(nextScores);
      renderSubscriberScores();
      if (scoreFeedback) scoreFeedback.textContent = "Score updated successfully.";
    });
  });
}

saveScoreButton?.addEventListener("click", () => {
  const nextScore = Number(scoreInput?.value);
  const nextDate = scoreDateInput?.value;

  if (!Number.isFinite(nextScore) || nextScore < 1 || nextScore > 45) {
    if (scoreFeedback) scoreFeedback.textContent = "Enter a Stableford score between 1 and 45.";
    return;
  }

  if (!nextDate) {
    if (scoreFeedback) scoreFeedback.textContent = "Please choose a played date.";
    return;
  }

  const nextScores = [...getSubscriberScores(), { score: nextScore, date: nextDate }]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  setSubscriberScores(nextScores);
  renderSubscriberScores();
  if (scoreFeedback) scoreFeedback.textContent = "New score saved. Only the latest 5 have been retained.";
});

if (editableScoreList && scoreBallsList) {
  renderSubscriberScores();
}

updatePreferencesButton?.addEventListener("click", () => {
  const nextSettings = {
    charity: charitySelect?.value || defaultSubscriberSettings.charity,
    contribution: Number(contributionSelect?.value || defaultSubscriberSettings.contribution),
    cadence: billingCadenceSelect?.value || defaultSubscriberSettings.cadence,
  };
  setSubscriberSettings(nextSettings);
  renderSubscriberSettings();
  renderSubscriptionState();
  if (preferencesFeedback) preferencesFeedback.textContent = "Subscriber settings updated successfully.";
});

manageBillingButton?.addEventListener("click", () => {
  const settings = getSubscriberSettings();
  settings.cadence = settings.cadence === "Monthly" ? "Yearly" : "Monthly";
  setSubscriberSettings(settings);
  renderSubscriberSettings();
  renderSubscriptionState();
  if (preferencesFeedback) preferencesFeedback.textContent = `Billing cadence switched to ${settings.cadence}.`;
});

applySubscriptionStatusButton?.addEventListener("click", () => {
  const nextStatus = subscriptionStatusSelect?.value || "active";
  const nextState = {
    ...getSubscriptionStatus(),
    status: nextStatus,
    cancellationStatus:
      nextStatus === "cancellation_scheduled" ? "Cancels at end of period" : "Not scheduled",
  };
  setSubscriptionStatus(nextState);
  renderSubscriptionState();
  if (preferencesFeedback) preferencesFeedback.textContent = `Subscription state changed to ${humanizeSubscriptionStatus(nextStatus)}.`;
});

chooseScreenshotButton?.addEventListener("click", () => {
  const claim = { ...getWinnerClaim(), proofStatus: "Screenshot attached", status: "pending_review" };
  setWinnerClaim(claim);
  renderWinnerClaim();
  if (proofFeedback) proofFeedback.textContent = "Screenshot attached successfully. Waiting for admin review.";
});

uploadProofButton?.addEventListener("click", () => {
  const claim = { ...getWinnerClaim(), proofStatus: "Pending review", status: "pending_review" };
  setWinnerClaim(claim);
  renderWinnerClaim();
  if (proofFeedback) proofFeedback.textContent = "Winner proof uploaded and submitted for verification.";
});

openProfilesButton?.addEventListener("click", () => {
  if (adminUserFeedback) adminUserFeedback.textContent = "Profiles workspace opened. Admin can now review user data.";
});

manageSubscriptionsButton?.addEventListener("click", () => {
  if (adminUserFeedback) adminUserFeedback.textContent = "Subscription management view opened with active and lapsed users.";
});

editCharitiesButton?.addEventListener("click", () => {
  if (adminCharityFeedback) adminCharityFeedback.textContent = "Charity listings opened for add, edit, and delete actions.";
});

manageMediaButton?.addEventListener("click", () => {
  if (adminCharityFeedback) adminCharityFeedback.textContent = "Charity media manager opened for content updates.";
});

runSimulationButton?.addEventListener("click", () => {
  const drawState = getDrawState();
  const mode = drawLogicSelect?.value || "random";
  const numbers = getDrawNumbersByMode(mode);
  const results = calculateDrawResults(numbers, drawState.prizePool);
  const nextState = {
    ...drawState,
    mode,
    lastNumbers: numbers,
    published: false,
    simulations: drawState.simulations + 1,
    reviewStatus: `${results.grouped[3].length + results.grouped[4].length + results.grouped[5].length} candidate winner groups`,
  };
  setDrawState(nextState);
  renderAdminDrawState();
  if (drawFeedback) {
    drawFeedback.textContent =
      `${humanizeSubscriptionStatus(mode)} simulation complete. ` +
      `${results.grouped[5].length} top-tier winner(s), rollover ${formatMoney(results.rollover)}.`;
  }
});

publishDrawButton?.addEventListener("click", () => {
  const drawState = getDrawState();
  const results = calculateDrawResults(drawState.lastNumbers, drawState.prizePool);
  const currentSubscriberResult =
    results.grouped[5].find((winner) => winner.name === "Samira Khan") ||
    results.grouped[4].find((winner) => winner.name === "Samira Khan") ||
    results.grouped[3].find((winner) => winner.name === "Samira Khan");

  const nextDrawState = {
    ...drawState,
    published: true,
    reviewStatus: `${results.grouped[3].length + results.grouped[4].length + results.grouped[5].length} winner record(s) published`,
  };
  setDrawState(nextDrawState);

  if (currentSubscriberResult) {
    const payoutByTier = results.payoutByTier[currentSubscriberResult.count];
    setWinnerClaim({
      ...getWinnerClaim(),
      totalWon: payoutByTier || getWinnerClaim().totalWon,
      matchedNumbers: currentSubscriberResult.matches,
      status: "pending_review",
      proofStatus: "Awaiting subscriber proof",
    });
    renderWinnerClaim();
  }

  renderAdminDrawState();
  if (drawFeedback) {
    drawFeedback.textContent = `Draw published for ${nextDrawState.publishedMonth}. Top-tier rollover: ${formatMoney(results.rollover)}.`;
  }
});

approveProofButton?.addEventListener("click", () => {
  const claim = { ...getWinnerClaim(), proofStatus: "Approved", status: "approved" };
  setWinnerClaim(claim);
  renderWinnerClaim();
  if (winnersFeedback) winnersFeedback.textContent = "Winner proof approved. Payout can now be completed.";
});

rejectProofButton?.addEventListener("click", () => {
  const claim = { ...getWinnerClaim(), proofStatus: "Rejected", status: "pending_review" };
  setWinnerClaim(claim);
  renderWinnerClaim();
  if (winnersFeedback) winnersFeedback.textContent = "Winner proof rejected. Subscriber must upload a new screenshot.";
});

markPaidButton?.addEventListener("click", () => {
  const claim = { ...getWinnerClaim(), proofStatus: "Paid", status: "paid" };
  setWinnerClaim(claim);
  renderWinnerClaim();
  if (winnersFeedback) winnersFeedback.textContent = "Payout marked as completed.";
});

renderSubscriberSettings();
renderSubscriptionState();
renderWinnerClaim();
renderAdminDrawState();
