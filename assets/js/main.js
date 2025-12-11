// assets/js/main.js

// =====================
// Утилиты предзагрузки
// =====================

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

// onProgress(progress [0..1], text?)
async function preloadCoreAssets(onProgress) {
  const images = [
    "assets/png/BG.png",
    "assets/png/Button_BG_Color.png",
    "assets/png/Button_BG_White.png",
    "assets/png/Button_Back.png",
    "assets/png/POI_Dot.png",
    "assets/png/Banner_ScanPicture.png",
    "assets/png/Paint.png",
  ];

  const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();

  onProgress && onProgress(0.15, "Загружаем шрифты…");
  await fontsReady;

  onProgress && onProgress(0.55, "Загружаем изображения…");
  await preloadImages(images);

  onProgress && onProgress(0.85, "Проверяем AR-данные…");
  try {
    await fetch("targets.mind", { cache: "force-cache" });
  } catch (e) {
    console.warn("Не удалось предварительно загрузить targets.mind", e);
  }

  onProgress && onProgress(1, "Готово! Запускаем меню…");
}

// =====================
// Главное меню + инструкция (index.html)
// =====================

function initMenuPage() {
  const preloader = document.querySelector('[data-screen="preloader"]');
  const menuMain = document.querySelector('[data-screen="menu-main"]');
  const screenInstructions = document.querySelector(
    '[data-screen="menu-instructions"]'
  );

  if (!menuMain) return; // не index.html

  const openInstructionsBtn = document.querySelector(
    '[data-action="open-instructions"]'
  );
  const startArBtn = document.querySelector('[data-action="start-ar"]');
  const backToMenuBtn = document.querySelector('[data-action="back-to-menu"]');

  const barFill = document.querySelector(".preloader__bar-fill");
  const labelEl = document.querySelector("[data-preloader-label]");

  function updatePreloader(progress, text) {
    const clamped = Math.max(0, Math.min(progress, 1));
    if (barFill) {
      barFill.style.width = `${clamped * 100}%`;
    }
    if (labelEl && text) {
      labelEl.textContent = text;
    }
  }

  function showScreen(screenToShow) {
    [menuMain, screenInstructions].forEach((screen) => {
      if (!screen) return;
      screen.hidden = screen !== screenToShow;
    });
  }

  // Показ меню после предзагрузки ассетов
  (async () => {
    try {
      await preloadCoreAssets(updatePreloader);
    } catch (e) {
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

// =====================
// AR-сцена (ar-scene.html)
// =====================

function initArPage() {
  const arRoot = document.querySelector("[data-ar-root]");
  if (!arRoot) return; // не ar-scene.html

  const exitBtn = document.querySelector('[data-action="exit-to-menu"]');
  const scanOverlay = document.querySelector("[data-ar-scan]");
  const scanTextEl = document.querySelector("[data-scan-text]");
  const introOverlay = document.querySelector("[data-ar-intro]");
  const introCloseBtn = document.querySelector('[data-action="close-intro"]');
  const poiPanel = document.querySelector("[data-ar-poi-panel]");
  const poiCloseBtn = document.querySelector('[data-action="close-poi"]');
  const poiTitleEl = document.querySelector("[data-poi-title]");
  const poiTextEl = document.querySelector("[data-poi-text]");

  exitBtn?.addEventListener("click", () => {
    window.location.href = "index.html";
  });

  // -------- контент трёх точек интереса --------

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

  function showPoi(id) {
    const content = poiContent[id];
    if (!content) return;
    if (poiTitleEl) poiTitleEl.textContent = content.title;
    if (poiTextEl) poiTextEl.textContent = content.text;
    if (poiPanel) poiPanel.hidden = false;
  }

  function setupArLogic() {
    const targetEntity = document.querySelector("#artwork-target");
    const poiGroup = document.querySelector("#poi-group");
    const poiEls = Array.from(document.querySelectorAll(".poi-ar"));

    // Клики по AR-точкам
    poiEls.forEach((el) => {
      const id = el.dataset.poi;
      if (!id) return;

      el.addEventListener("click", () => {
        showPoi(id);
      });

      el.addEventListener("mouseenter", () => {
        el.setAttribute("scale", "1.1 1.1 1.1");
      });
      el.addEventListener("mouseleave", () => {
        el.setAttribute("scale", "1 1 1");
      });
    });

    // Закрытие вводной панели — включаем POI
    introCloseBtn?.addEventListener("click", () => {
      if (introOverlay) introOverlay.hidden = true;
      if (poiGroup) poiGroup.setAttribute("visible", "true");
    });

    // Закрытие панели точки интереса
    poiCloseBtn?.addEventListener("click", () => {
      if (poiPanel) poiPanel.hidden = true;
    });

    if (targetEntity) {
      targetEntity.addEventListener("targetFound", () => {
        if (scanOverlay) scanOverlay.style.display = "none";

        if (!introShown && introOverlay) {
          introOverlay.hidden = false;
          introShown = true;
        }
      });

      // targetLost — панель по ТЗ не закрываем
    }
  }

  // -------- лёгкая проверка камеры (без getUserMedia, не ломаем MindAR) --------

  async function checkCameraSupport() {
    if (!scanTextEl) return;

    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      scanTextEl.textContent =
        "Камера не поддерживается в этом браузере. Откройте сцену в Chrome, Safari или Яндекс.Браузере.";
      return;
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasVideoInput = devices.some(
        (d) => d && d.kind === "videoinput"
      );

      if (!hasVideoInput) {
        scanTextEl.textContent =
          "Камера не найдена. Подключите камеру и обновите страницу.";
        return;
      }
    } catch (e) {
      console.warn("enumerateDevices error", e);
    }

    // Если Permissions API поддерживается — проверим, не запрещена ли камера
    if (navigator.permissions && navigator.permissions.query) {
      try {
        const status = await navigator.permissions.query({ name: "camera" });

        if (status.state === "denied") {
          scanTextEl.textContent =
            "Доступ к камере запрещён. Разрешите доступ в настройках браузера и перезапустите сцену.";
          return;
        }

        status.onchange = () => {
          if (status.state === "denied") {
            scanTextEl.textContent =
              "Доступ к камере запрещён. Разрешите доступ в настройках браузера.";
          }
        };
      } catch (e) {
        console.warn("permissions.query(camera) error", e);
      }
    }

    // Всё ок — MindAR сам покажет нативный запрос доступа
    scanTextEl.textContent = "Наведите камеру на картину, чтобы начать.";
  }

  checkCameraSupport();

  // Ждём, пока загрузится a-scene, чтобы все a-entity уже были в DOM
  const sceneEl = document.querySelector("a-scene");
  if (sceneEl) {
    if (sceneEl.hasLoaded) {
      setupArLogic();
    } else {
      sceneEl.addEventListener("loaded", setupArLogic);
    }
  }
}

// =====================
// Точка входа
// =====================

document.addEventListener("DOMContentLoaded", () => {
  initMenuPage();
  initArPage();
});
