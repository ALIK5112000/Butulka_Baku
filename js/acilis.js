document.addEventListener('DOMContentLoaded', () => {
  const progressFill = document.getElementById('progressFill');
  const loadingStage = document.getElementById('loadingStage');
  const titleStage = document.getElementById('titleStage');
  const splashScreen = document.getElementById('splashScreen');
  const gameContainer = document.getElementById('gameContainer');

  let percent = 0;

  // 1-ci mərhələ: Yükləmə çubuğu 0-dan 100%-ə qədər dolur
  const loadInterval = setInterval(() => {
    percent += 4;
    if (percent > 100) percent = 100;
    progressFill.style.width = percent + '%';

    if (percent >= 100) {
      clearInterval(loadInterval);

      // Çubuq dolandan 0.2 saniyə sonra gizlənir və BUTULKA BAKU yazısı çıxır
      setTimeout(() => {
        loadingStage.classList.add('hidden');
        titleStage.classList.remove('hidden');

        // 2.2 saniyə BUTULKA BAKU logosu görünür, sonra oyun masası açılır
        setTimeout(() => {
          splashScreen.style.opacity = '0';
          setTimeout(() => {
            splashScreen.classList.add('hidden');
            gameContainer.classList.remove('hidden');
          }, 600);
        }, 2200);
      }, 200);
    }
  }, 60);
});
