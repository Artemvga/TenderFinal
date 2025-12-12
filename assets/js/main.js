// assets/js/main.js

// ======================================================
// DEVICE SPLIT (iOS Safari / Android Chrome & Yandex)
// + FIX 100vh ON MOBILE SAFARI (address bar / safe-area)
// ======================================================

/**
 * Определяем платформу/браузер и выставляем классы на <html>.
 * Это даёт «разделение на устройства» (для CSS/логики).
 */
function getDeviceInfo() {
  const ua = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const maxTouchPoints = navigator.maxTouchPoints || 0;

  // iPadOS часто маскируется под Mac
  const isIpadOS = platform === "MacIntel" && maxTouchPoints > 1;
  const isIOS = isIpadOS || /iPad|iPhone|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);

  const isYandex = /YaBrowser/i.test(ua);
  const isEdge = /Edg/i.test(ua);
  const isOpera = /OPR|Opera/i.test(ua);
  const isFirefox = /Firefox|FxiOS/i.test(ua);

  // Chrome на iOS называется CriOS и всегда содержит Safari в UA
  const isChrome =
    (/Chrome|CriOS|Chromium/i.test(ua) && !isEdge && !isOpera && !isYandex) ||
    false;
  const isSafari =
    /Safari/i.test(ua) &&
    !/CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser/i.test(ua) &&
    !isAndroid;

  // Частые in-app браузеры (там камера может быть ограничена)
  const isInApp =
    /Instagram/i.test(ua) ||
    /FBAN|FBAV/i.test(ua) ||
    /Telegram/i.test(ua) ||
    /TikTok/i.test(ua) ||
    /VKClient|VKA/i.test(ua);

  return {
    ua,
    isIOS,
    isAndroid,
    isSafari,
    isChrome,
    isYandex,
    isInApp,
  };
}

function applyDeviceClasses() {
  const info = getDeviceInfo();
  const root = document.documentElement;

  root.classList.toggle("is-ios", !!info.isIOS);
  root.classList.toggle("is-android", !!info.isAndroid);
  root.classList.toggle("is-safari", !!info.isSafari);
  root.classList.toggle("is-chrome", !!info.isChrome);
  root.classList.toggle("is-yandex", !!info.isYandex);
  root.classList.toggle("is-inapp", !!info.isInApp);

  root.dataset.os = info.isIOS ? "ios" : info.isAndroid ? "android" : "other";
  root.dataset.browser = info.isSafari
    ? "safari"
    : info.isYandex
    ? "yandex"
    : info.isChrome
    ? "chrome"
    : "other";

  // Чтобы можно было использовать и в других скриптах (например, ar-scene.html)
  window.__DEVICE_INFO__ = info;
  return info;
}

/**
 * Фикс «100vh» для мобильного Safari (и не только):
 * создаём CSS-переменную --vh, равную 1% реальной видимой высоты.
 */
function updateViewportUnits() {
  const root = document.documentElement;
  const viewportHeight =
    (window.visualViewport && window.visualViewport.height) ||
    window.innerHeight ||
    0;
  if (!viewportHeight) return;
  root.style.setProperty("--vh", `${viewportHeight * 0.01}px`);
}

// ======================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ПРЕДЗАГРУЗКИ РЕСУРСОВ
// ======================================================

/**
 * Простая предзагрузка массива картинок.
 * @param {string[]} urls - список путей к изображениям
 * @returns {Promise<void[]>}
 */
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

/**
 * Предзагружаем шрифты, ключевые картинки и targets.mind.
 * Вызываем onProgress, чтобы обновлять прогрессбар на прелоадере.
 * @param {(progress: number, text?: string) => void} onProgress
 */
async function preloadCoreAssets(onProgress) {
  const images = [
    "assets/png/BG_2.png",
    "assets/png/Button_BG_Color.png",
    "assets/png/Button_BG_White.png",
    "assets/png/Button_Back.png",
    "assets/png/POI_Dot.png",
    "assets/png/Banner_ScanPicture.png",
    "assets/png/Paint.png",
  ];

  // 1) ждём шрифты
  const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();

  if (onProgress) onProgress(0.15, "Загружаем шрифты…");
  await fontsReady;

  // 2) грузим изображения
  if (onProgress) onProgress(0.55, "Загружаем изображения…");
  await preloadImages(images);

  // 3) пробуем заранее скачать targets.mind (AR-таргет)
  if (onProgress) onProgress(0.85, "Проверяем AR-данные…");
  try {
    await fetch("targets.mind", { cache: "force-cache" });
  } catch (e) {
    console.warn("Не удалось предварительно загрузить targets.mind", e);
  }

  if (onProgress) onProgress(1, "Готово! Запускаем меню…");
}

// ======================================================
// ГЛАВНОЕ МЕНЮ + ЭКРАН ИНСТРУКЦИИ (index.html)
// ======================================================

function initMenuPage() {
  // Если на странице нет главного меню — это не index.html
  const preloader = document.querySelector('[data-screen="preloader"]');
  const menuMain = document.querySelector('[data-screen="menu-main"]');
  const screenInstructions = document.querySelector(
    '[data-screen="menu-instructions"]'
  );

  if (!menuMain) return; // тихо выходим — дальше отработает initArPage

  const openInstructionsBtn = document.querySelector(
    '[data-action="open-instructions"]'
  );
  const startArBtn = document.querySelector('[data-action="start-ar"]');
  const backToMenuBtn = document.querySelector('[data-action="back-to-menu"]');

  const barFill = document.querySelector(".preloader__bar-fill");
  const labelEl = document.querySelector("[data-preloader-label]");

  /**
   * Обновление прогресса на прелоадере.
   * @param {number} progress 0..1
   * @param {string} [text]
   */
  function updatePreloader(progress, text) {
    const clamped = Math.max(0, Math.min(progress, 1));
    if (barFill) {
      barFill.style.width = `${clamped * 100}%`;
    }
    if (labelEl && text) {
      labelEl.textContent = text;
    }
  }

  /**
   * Переключение между экранами:
   * - главное меню (menu-main)
   * - инструкция (menu-instructions)
   */
  function showScreen(screenToShow) {
    const screens = [menuMain, screenInstructions];
    screens.forEach((screen) => {
      if (!screen) return;
      screen.hidden = screen !== screenToShow;
    });
  }

  // Асинхронный блок: сначала предзагружаем ресурсы, потом показываем меню
  (async () => {
    try {
      await preloadCoreAssets(updatePreloader);
    } catch (e) {
      console.error("Preload failed", e);
      // Даже если что-то не загрузилось — всё равно покажем меню
    }

    if (preloader) {
      preloader.style.display = "none";
    }
    showScreen(menuMain);
  })();

  // Открыть инструкцию
  if (openInstructionsBtn) {
    openInstructionsBtn.addEventListener("click", () => {
      showScreen(screenInstructions);
    });
  }

  // Назад в меню из инструкции
  if (backToMenuBtn) {
    backToMenuBtn.addEventListener("click", () => {
      showScreen(menuMain);
    });
  }

  // Переход в AR-сцену
  if (startArBtn) {
    startArBtn.addEventListener("click", () => {
      window.location.href = "ar-scene.html";
    });
  }
}

// ======================================================
// AR-СЦЕНА (ar-scene.html)
// ======================================================

function initArPage() {
  // Если на странице нет корневого AR-UI — это не ar-scene.html
  const arRoot = document.querySelector("[data-ar-root]");
  if (!arRoot) return;

  // Элементы AR UI
  const exitBtn = document.querySelector('[data-action="exit-to-menu"]');
  const scanOverlay = document.querySelector("[data-ar-scan]");
  const introOverlay = document.querySelector("[data-ar-intro]");
  const introCloseBtn = document.querySelector('[data-action="close-intro"]');
  const poiPanel = document.querySelector("[data-ar-poi-panel]");
  const poiCloseBtn = document.querySelector('[data-action="close-poi"]');
  const poiTitleEl = document.querySelector("[data-poi-title]");
  const poiTextEl = document.querySelector("[data-poi-text]");

  // Кнопка выхода слева сверху
  if (exitBtn) {
    exitBtn.addEventListener("click", () => {
      window.location.href = "index.html";
    });
  }

  // Контент для трёх точек интереса
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

  // Флаг, чтобы вводная панель показалась только один раз
  let introShown = false;
  // Флаг, чтобы знать, отслеживается ли сейчас маркер (targetFound / targetLost)
  let markerVisible = false;
  // Флаг включённости хит-теста по POI:
  // по умолчанию false — сначала пользователь читает вводную.
  let poiTouchEnabled = false;

  /**
   * Показ панели с содержимым точки интереса.
   * @param {number} id - 1, 2 или 3
   */
  function showPoi(id) {
    const content = poiContent[id];
    if (!content) return;

    if (poiTitleEl) poiTitleEl.textContent = content.title;
    if (poiTextEl) poiTextEl.textContent = content.text;
    if (poiPanel) poiPanel.hidden = false;
  }

  /**
   * Логика хит-теста: проверяем попадание по экрану вокруг POI.
   * @param {Element[]} poiHits - список .poi-hit (невидимых кругов)
   * @param {Element|null} poiGroup - контейнер с POI
   */
  function setupPoiTouchHitTest(poiHits, poiGroup) {
    const sceneEl = document.querySelector("a-scene");
    if (!sceneEl || !poiHits.length) return;

    // Берём THREE из глобала (A-Frame его поднимает)
    const THREERef =
      window.THREE || (window.AFRAME && window.AFRAME.THREE);
    if (!THREERef) {
      console.warn("THREE не найден, хит-тест по POI недоступен");
      return;
    }

    /**
     * Вычисляем экранные координаты всех POI (.poi-hit).
     * @returns {{id:number,x:number,y:number}[]}
     */
    function getPoiScreenPositions() {
      const camera = sceneEl.camera;
      if (!camera) return [];
      const w =
        window.innerWidth || document.documentElement.clientWidth || 1;
      const h =
        window.innerHeight || document.documentElement.clientHeight || 1;

      const results = [];

      poiHits.forEach((hit) => {
        const idStr = hit.dataset.poi;
        const id = parseInt(idStr, 10);
        if (!id || !poiContent[id]) return;

        const worldPos = new THREERef.Vector3();
        hit.object3D.getWorldPosition(worldPos);

        // Проецируем мировую позицию в NDC (-1..1)
        worldPos.project(camera);

        // Переводим в пиксели экрана
        const x = (worldPos.x * 0.5 + 0.5) * w;
        const y = (-worldPos.y * 0.5 + 0.5) * h;

        results.push({ id, x, y });
      });

      return results;
    }

    /**
     * Обработка клика/тача по экрану: проверяем, попали ли мы
     * в радиус вокруг одной из точек.
     */
    function handlePointer(evt) {
      if (!poiGroup) return;

      // 1) Если вводная или панель POI видны — игнорируем хит-тест,
      //    чтобы не мешать нажимать на кнопки.
      const introVisible = introOverlay && !introOverlay.hidden;
      const poiPanelVisible = poiPanel && !poiPanel.hidden;
      if (introVisible || poiPanelVisible) {
        return;
      }

      // 2) Доп. флаг: если хит-тест временно выключен — выходим.
      if (!poiTouchEnabled) return;

      // 3) POI должны быть видимы (вводная уже закрыта)
      const visibleAttr = poiGroup.getAttribute("visible");
      const groupVisible =
        visibleAttr === true || visibleAttr === "true";
      if (!groupVisible) return;

      // 4) Маркер должен быть отслеживаемым
      if (!markerVisible) return;

      const isTouch = evt.touches && evt.touches.length;
      const clientX = isTouch ? evt.touches[0].clientX : evt.clientX;
      const clientY = isTouch ? evt.touches[0].clientY : evt.clientY;
      if (clientX == null || clientY == null) return;

      const w =
        window.innerWidth || document.documentElement.clientWidth || 1;
      const h =
        window.innerHeight || document.documentElement.clientHeight || 1;

      // Радиус вокруг точки: 12% от меньшей стороны экрана
      const radius = Math.min(w, h) * 0.12;
      const radiusSq = radius * radius;

      const poiScreens = getPoiScreenPositions();
      let bestId = null;
      let bestDistSq = Infinity;

      for (const p of poiScreens) {
        const dx = clientX - p.x;
        const dy = clientY - p.y;
        const distSq = dx * dx + dy * dy;
        if (distSq <= radiusSq && distSq < bestDistSq) {
          bestDistSq = distSq;
          bestId = p.id;
        }
      }

      if (bestId != null) {
        // Пользователь попал в POI → показываем панель
        // и сразу выключаем хит-тест до закрытия панели.
        poiTouchEnabled = false;
        showPoi(bestId);
      }
    }

    // Слушаем клики/тапы на всём окне.
    // Pointer Events работают и на iPhone (Safari) и на Android (Chrome/Яндекс) —
    // это самый ровный кросс-платформенный вариант.
    if (window.PointerEvent) {
      window.addEventListener("pointerdown", handlePointer, { passive: true });
    } else {
      window.addEventListener("click", handlePointer);
      window.addEventListener("touchstart", handlePointer, { passive: true });
    }
  }

  /**
   * Основная логика AR:
   * - targetFound → показываем вводную панель
   * - закрытие вводной → показываем POI + включаем хит-тест через 1 секунду
   * - хит-тест по экрану вокруг POI → панели с текстом
   */
  function setupArLogic() {
    const targetEntity = document.querySelector("#artwork-target");
    const poiGroup = document.querySelector("#poi-group");
    const poiHits = Array.from(document.querySelectorAll(".poi-hit"));

    // Немного hover-анимации для десктопа (если работает raycaster)
    poiHits.forEach((hit) => {
      const wrapper = hit.parentElement;
      const icon = wrapper
        ? wrapper.querySelector(".poi-icon")
        : null;

      if (!icon) return;

      hit.addEventListener("mouseenter", () => {
        icon.setAttribute("scale", "1.15 1.15 1.15");
      });
      hit.addEventListener("mouseleave", () => {
        icon.setAttribute("scale", "1 1 1");
      });
    });

    // Хит-тест по экрану (клик/тап в радиусе вокруг POI)
    setupPoiTouchHitTest(poiHits, poiGroup);

    // Закрытие вводной панели → включаем POI и
    // включаем хит-тест ТОЛЬКО через 1 секунду
    if (introCloseBtn) {
      introCloseBtn.addEventListener("click", () => {
        if (introOverlay) introOverlay.hidden = true;
        if (poiGroup) poiGroup.setAttribute("visible", "true");

        setTimeout(() => {
          poiTouchEnabled = true;
        }, 1000);
      });
    }

    // Закрытие панели точки интереса
    if (poiCloseBtn) {
      poiCloseBtn.addEventListener("click", () => {
        if (poiPanel) poiPanel.hidden = true;

        // Включаем хит-тест ПОСЛЕ закрытия панели, с паузой 1 сек.
        setTimeout(() => {
          poiTouchEnabled = true;
        }, 1000);
      });
    }

    // Реакция на распознавание маркера MindAR
    if (targetEntity) {
      targetEntity.addEventListener("targetFound", () => {
        markerVisible = true;

        // Прячем экран "Сканируем"
        if (scanOverlay) {
          scanOverlay.style.display = "none";
        }

        // Первый раз показываем вводную панель
        if (!introShown && introOverlay) {
          introOverlay.hidden = false;
          introShown = true;
        }
      });

      // targetLost: маркер перестали видеть, но панель по ТЗ не закрываем.
      targetEntity.addEventListener("targetLost", () => {
        markerVisible = false;
      });
    }
  }

  // Только логика AR — камерой полностью управляет MindAR
  setupArLogic();
}

// ======================================================
// ТОЧКА ВХОДА ДЛЯ ОБЕИХ СТРАНИЦ
// ======================================================

document.addEventListener("DOMContentLoaded", () => {
  // 1) Добавляем классы под устройство/браузер (для CSS и условий в JS)
  applyDeviceClasses();

  // 2) Фиксим высоту «100vh» (особенно важно для iPhone/Safari)
  updateViewportUnits();
  window.addEventListener("resize", updateViewportUnits, { passive: true });
  window.addEventListener("orientationchange", updateViewportUnits, {
    passive: true,
  });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", updateViewportUnits, {
      passive: true,
    });
  }
  window.addEventListener("pageshow", updateViewportUnits);

  initMenuPage(); // отработает только на index.html
  initArPage();   // отработает только на ar-scene.html
});
