// assets/js/main.js

// ---------- Общие утилиты ----------

function preloadImages(urls) {
  const promises = urls.map((url) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = img.onerror = () => resolve();
      img.src = url;
    });
  });
  return Promise.all(promises);
}

async function preloadCoreAssets() {
  const images = [
    "assets/png/BG.png",
    "assets/png/Button_BG_Color.png",
    "assets/png/Button_Back.png",
    "assets/png/POI_Dot.png",
    "assets/png/Banner_ScanPicture.png",
    "assets/png/Paint.png",
  ];

  const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();

  await Promise.all([preloadImages(images), fontsReady]);
}

// ---------- Инициализация главного меню ----------

function initMenuPage() {
  const preloader = document.querySelector('[data-screen="preloader"]');
  const menuMain = document.querySelector('[data-screen="menu-main"]');
  const screenInstructions = document.querySelector(
    '[data-screen="menu-instructions"]'
  );

  if (!menuMain) return; // не та страница

  const openInstructionsBtn = document.querySelector(
    '[data-action="open-instructions"]'
  );
  const startArBtn = document.querySelector('[data-action="start-ar"]');
  const backToMenuBtn = document.querySelector('[data-action="back-to-menu"]');

  function showScreen(screenToShow) {
    [menuMain, screenInstructions].forEach((screen) => {
      if (!screen) return;
      screen.hidden = screen !== screenToShow;
    });
  }

  // Покажем меню после предзагрузки ассетов
  (async () => {
    try {
      await preloadCoreAssets();
    } catch (e) {
      // на всякий случай просто продолжаем
      console.warn("Preload failed", e);
    }

    if (preloader) preloader.style.display = "none";
    showScreen(menuMain);
  })();

  openInstructionsBtn?.addEventListener("click", () => {
    showScreen(screenInstructions);
  });

  backToMenuBtn?.addEventListener("click", () => {
    showScreen(menuMain);
  });

  startArBtn?.addEventListener("click", () => {
    window.location.href = "ar-scene.html";
  });
}

// ---------- Инициализация AR-сцены ----------

function initArPage() {
  const arRoot = document.querySelector("[data-ar-root]");
  if (!arRoot) return; // не AR-страница

  const exitBtn = document.querySelector('[data-action="exit-to-menu"]');
  const scanOverlay = document.querySelector("[data-ar-scan]");
  const introOverlay = document.querySelector("[data-ar-intro]");
  const introCloseBtn = document.querySelector('[data-action="close-intro"]');
  const poiContainer = document.querySelector("[data-ar-pois]");
  const poiPanel = document.querySelector("[data-ar-poi-panel]");
  const poiCloseBtn = document.querySelector('[data-action="close-poi"]');

  const poiTitleEl = document.querySelector("[data-poi-title]");
  const poiTextEl = document.querySelector("[data-poi-text]");

  const poiButtons = Array.from(document.querySelectorAll(".poi"));

  const poiContent = {
    1: {
      title: "Потерянный портрет.",
      text: `
О существовании портрета Николая II долгое время не знали — он обнаружился
лишь на аукционе в 1990-е годы. Тогда выяснилось, что после революции, когда
большевики вывозили из Мариинского дворца картины, в зале Государственного
совета нашли полотно Репина, а неподалёку — ещё одну раму. В ней и оказался
портрет Николая II кисти Репина.
      `.trim(),
    },
    2: {
      title: "Художественные образы.",
      text: `
Созданные Репиным образы обладают самостоятельной художественной ценностью.
Так, обер-прокурор Победоносцев изображён с бескровным лицом, стёртыми
чертами и тусклым взглядом. Он словно воплощает мёртвый и мертвящий
бюрократизм. Это один из немногих портретов, в которых заметно негативное
отношение художника к своему персонажу.
      `.trim(),
    },
    3: {
      title: "Композиция.",
      text: `
Чтобы уравновесить и оживить композицию из десятков сидящих фигур, Репин
предложил слева изобразить во весь рост графа Бобринского, а справа —
служащего канцелярии. В центре он разместил государственного секретаря Плеве,
читающего высочайший указ. Если мысленно соединить три стоящие фигуры,
получится треугольник, создающий ощущение пространства и ясно выявляющий
перспективу.
      `.trim(),
    },
  };

  let introShown = false;

  exitBtn?.addEventListener("click", () => {
    window.location.href = "index.html";
  });

  introCloseBtn?.addEventListener("click", () => {
    if (introOverlay) introOverlay.hidden = true;
    if (poiContainer) poiContainer.hidden = false;
  });

  poiCloseBtn?.addEventListener("click", () => {
    if (poiPanel) poiPanel.hidden = true;
  });

  poiButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.poi;
      const content = poiContent[id];

      if (!content) return;

      if (poiTitleEl) poiTitleEl.textContent = content.title;
      if (poiTextEl) poiTextEl.textContent = content.text;
      if (poiPanel) poiPanel.hidden = false;
    });
  });

  // Связка с MindAR: показываем вводную панель при первом распознавании
  const targetEntity = document.querySelector("#artwork-target");

  if (targetEntity) {
    targetEntity.addEventListener("targetFound", () => {
      if (scanOverlay) scanOverlay.style.display = "none";

      if (!introShown && introOverlay) {
        introOverlay.hidden = false;
        introShown = true;
      }
    });

    // ВНИМАНИЕ: по заданию при пропаже метки панель не закрываем,
    // поэтому на targetLost ничего не делаем.
    // targetEntity.addEventListener("targetLost", () => {});
  }
}

// ---------- Точка входа ----------

document.addEventListener("DOMContentLoaded", () => {
  initMenuPage();
  initArPage();
});
