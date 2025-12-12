// assets/js/main.js

// ======================================================
// 0) ПАТЧ ДЛЯ ANDROID: "любой камерой", если facingMode упал
// ======================================================
// Это помогает в случаях, когда библиотека пытается открыть environment-камеру
// и на конкретном телефоне/браузере это падает. Тогда мы автоматически
// повторяем запрос с максимально простыми constraints: { video: true }.
(() => {
  // Патчим ТОЛЬКО на AR-странице (где есть mindar-image сцена)
  const isArPage = !!document.querySelector("a-scene[mindar-image]");
  if (!isArPage) return;

  const md = navigator.mediaDevices;
  if (!md || typeof md.getUserMedia !== "function") return;

  // чтобы не патчить дважды
  if (md.getUserMedia.__patchedForMindAR) return;

  const original = md.getUserMedia.bind(md);

  md.getUserMedia = async (constraints) => {
    try {
      return await original(constraints);
    } catch (err1) {
      console.warn("[Camera] First getUserMedia failed, retrying with video:true", err1);

      // 1) если были хитрые constraints — пробуем "облегчённый" вариант без facingMode/deviceId
      try {
        const fallback = { audio: false, video: true };
        return await original(fallback);
      } catch (err2) {
        console.error("[Camera] Fallback getUserMedia failed", err2);
        throw err1; // чаще информативнее (NotAllowedError и т.п.)
      }
    }
  };

  md.getUserMedia.__patchedForMindAR = true;
})();

// ======================================================
// 1) ПРЕДЗАГРУЗКА РЕСУРСОВ (МЕНЮ)
// ======================================================

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
    "assets/png/Button_BG_White.png",
    "assets/png/Button_Back.png",
    "assets/png/POI_Dot.png",
    "assets/png/Banner_ScanPicture.png",
    "assets/png/Paint.png",
  ];

  const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
  await Promise.all([preloadImages(images), fontsReady]);

  // targets.mind — попробуем слегка прогреть кэш (не критично)
  try {
    await fetch("targets.mind", { cache: "force-cache" });
  } catch (e) {
    // не блокируем
  }
}

// ======================================================
// 2) МЕНЮ (index.html)
// ======================================================

function initMenuPage() {
  const preloader = document.querySelector('[data-screen="preloader"]');
  const menuMain = document.querySelector('[data-screen="menu-main"]');
  const screenInstructions = document.querySelector('[data-screen="menu-instructions"]');

  if (!menuMain) return; // не index.html

  const openInstructionsBtn = document.querySelector('[data-action="open-instructions"]');
  const startArBtn = document.querySelector('[data-action="start-ar"]');
  const backToMenuBtn = document.querySelector('[data-action="back-to-menu"]');

  function showScreen(screenToShow) {
    [menuMain, screenInstructions].forEach((screen) => {
      if (!screen) return;
      screen.hidden = screen !== screenToShow;
    });
  }

  (async () => {
    try {
      await preloadCoreAssets();
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

// ======================================================
// 3) AR-СЦЕНА (ar-scene.html)
// ======================================================

function initArPage() {
  const arRoot = document.querySelector("[data-ar-root]");
  if (!arRoot) return;

  const exitBtn = document.querySelector('[data-action="exit-to-menu"]');
  const scanOverlay = document.querySelector("[data-ar-scan]");
  const scanText = document.querySelector("[data-scan-text]");

  const introOverlay = document.querySelector("[data-ar-intro]");
  const introCloseBtn = document.querySelector('[data-action="close-intro"]');

  const poiPanel = document.querySelector("[data-ar-poi-panel]");
  const poiCloseBtn = document.querySelector('[data-action="close-poi"]');
  const poiTitleEl = document.querySelector("[data-poi-title]");
  const poiTextEl = document.querySelector("[data-poi-text]");

  const sceneEl = document.querySelector("a-scene");
  const targetEntity = document.querySelector("#artwork-target");
  const poiGroup = document.querySelector("#poi-group");
  const poiHits = Array.from(document.querySelectorAll(".poi-hit"));

  // Контент
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

  // Флаги
  let introShown = false;
  let markerVisible = false;

  // Важно: пока открыта вводная/POI панель — тапы по POI не работают.
  // И после закрытия включаем через 1 секунду.
  let poiTouchEnabled = false;

  // Выход
  exitBtn?.addEventListener("click", () => {
    window.location.href = "index.html";
  });

  // Показ POI панели
  function showPoi(id) {
    const content = poiContent[id];
    if (!content) return;

    if (poiTitleEl) poiTitleEl.textContent = content.title;
    if (poiTextEl) poiTextEl.textContent = content.text;
    if (poiPanel) poiPanel.hidden = false;
  }

  // Закрытие вводной панели
  introCloseBtn?.addEventListener("click", () => {
    if (introOverlay) introOverlay.hidden = true;
    if (poiGroup) poiGroup.setAttribute("visible", "true");

    // включаем отслеживание POI через 1 секунду
    setTimeout(() => {
      poiTouchEnabled = true;
    }, 1000);
  });

  // Закрытие POI панели
  poiCloseBtn?.addEventListener("click", () => {
    if (poiPanel) poiPanel.hidden = true;

    // включаем отслеживание POI через 1 секунду
    setTimeout(() => {
      poiTouchEnabled = true;
    }, 1000);
  });

  // ======================================================
  // КАМЕРА: arReady / arError + форс-ресайз
  // ======================================================

  function forceARResize() {
    const w = window.innerWidth || document.documentElement.clientWidth || 1;
    const h = window.innerHeight || document.documentElement.clientHeight || 1;

    // A-Frame renderer/camera
    try {
      if (sceneEl && sceneEl.renderer) {
        sceneEl.renderer.setSize(w, h);
      }
      if (sceneEl && sceneEl.camera) {
        sceneEl.camera.aspect = w / h;
        sceneEl.camera.updateProjectionMatrix();
      }
    } catch (e) {}

    // canvas
    try {
      if (sceneEl && sceneEl.canvas) {
        sceneEl.canvas.style.width = "100vw";
        sceneEl.canvas.style.height = "100vh";
      }
    } catch (e) {}

    // video (MindAR обычно создаёт <video> в DOM)
    const videoEl = document.querySelector("video");
    if (videoEl) {
      videoEl.style.width = "100vw";
      videoEl.style.height = "100vh";
      videoEl.style.objectFit = "cover";
    }
  }

  if (sceneEl) {
    // MindAR события (официальные)
    sceneEl.addEventListener("arReady", () => {
      // камера должна быть готова
      if (scanText) scanText.textContent = "Наведите камеру на картину, чтобы начать.";
      // форсим ресайз (часто решает «камера в углу / не видно»)
      setTimeout(forceARResize, 50);
      setTimeout(forceARResize, 250);
    });

    sceneEl.addEventListener("arError", () => {
      // чаще всего это камера не стартовала / нет прав
      if (scanText) {
        scanText.textContent =
          "Камера не запустилась. Проверьте разрешение камеры для сайта в Chrome (иконка замка) и перезайдите.";
      }
      setTimeout(forceARResize, 100);
    });

    // Дополнительно: ресайз при повороте/изменении
    window.addEventListener("resize", () => {
      forceARResize();
    });

    window.addEventListener("orientationchange", () => {
      setTimeout(forceARResize, 200);
      setTimeout(forceARResize, 600);
    });
  }

  // ======================================================
  // POI хит-тест по экрану (тап рядом с точкой)
  // ======================================================

  const THREERef = window.THREE || (window.AFRAME && window.AFRAME.THREE);

  function getPoiScreenPositions() {
    if (!sceneEl || !sceneEl.camera || !THREERef) return [];

    const w = window.innerWidth || document.documentElement.clientWidth || 1;
    const h = window.innerHeight || document.documentElement.clientHeight || 1;

    const results = [];

    poiHits.forEach((hit) => {
      const id = parseInt(hit.dataset.poi, 10);
      if (!id || !poiContent[id]) return;

      const worldPos = new THREERef.Vector3();
      hit.object3D.getWorldPosition(worldPos);
      worldPos.project(sceneEl.camera);

      const x = (worldPos.x * 0.5 + 0.5) * w;
      const y = (-worldPos.y * 0.5 + 0.5) * h;

      results.push({ id, x, y });
    });

    return results;
  }

  function handleTap(evt) {
    // Если пользователь тыкает по UI (кнопка выхода/панель) — POI не трогаем
    const target = evt.target;
    if (target && target.closest && target.closest(".panel, .btn-back")) return;

    // Если открыта вводная или POI панель — полностью отключаем обработку
    const introVisible = introOverlay && !introOverlay.hidden;
    const poiPanelVisible = poiPanel && !poiPanel.hidden;
    if (introVisible || poiPanelVisible) return;

    if (!poiTouchEnabled) return;
    if (!markerVisible) return;

    // POI должны быть видимы
    const groupVisible = poiGroup && (poiGroup.getAttribute("visible") === true || poiGroup.getAttribute("visible") === "true");
    if (!groupVisible) return;

    const w = window.innerWidth || document.documentElement.clientWidth || 1;
    const h = window.innerHeight || document.documentElement.clientHeight || 1;

    // Тап координаты
    const clientX = evt.clientX ?? (evt.touches && evt.touches[0] && evt.touches[0].clientX);
    const clientY = evt.clientY ?? (evt.touches && evt.touches[0] && evt.touches[0].clientY);
    if (clientX == null || clientY == null) return;

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
      // Открываем POI панель и выключаем трекинг до закрытия
      poiTouchEnabled = false;
      showPoi(bestId);
    }
  }

  // Pointer Events (на Android Chrome — идеально)
  if ("PointerEvent" in window) {
    window.addEventListener("pointerdown", handleTap, { passive: true });
  } else {
    // fallback
    window.addEventListener("touchstart", handleTap, { passive: true });
    window.addEventListener("click", handleTap);
  }

  // ======================================================
  // MindAR: targetFound/targetLost
  // ======================================================

  if (targetEntity) {
    targetEntity.addEventListener("targetFound", () => {
      markerVisible = true;

      // прячем экран сканирования
      if (scanOverlay) scanOverlay.style.display = "none";

      // показываем вводную один раз
      if (!introShown && introOverlay) {
        introOverlay.hidden = false;
        introShown = true;

        // пока вводная открыта — POI не кликаются
        poiTouchEnabled = false;
      }
    });

    targetEntity.addEventListener("targetLost", () => {
      markerVisible = false;
      // по ТЗ панели НЕ закрываем
    });
  }
}

// ======================================================
// 4) Точка входа
// ======================================================

document.addEventListener("DOMContentLoaded", () => {
  initMenuPage();
  initArPage();
});
