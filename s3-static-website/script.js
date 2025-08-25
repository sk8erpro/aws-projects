// --- KANVAS VE TEMEL DEĞİŞKENLER ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const previewButton = document.getElementById('previewButton');
const bgLayers = document.querySelectorAll('.bg-gradient'); // YENİ: İki katmanı da seç
canvas.width = 800; canvas.height = 600;

const scoreEl = document.getElementById('score');
const comboEl = document.getElementById('combo');
const livesEl = document.getElementById('lives');
const gameOverScreen = document.getElementById('gameOverScreen');

// --- OYUN AYARLARI ---
const GRAVITY = 0.5;
const MIN_PLATFORM_DISTANCE = 150; const MAX_PLATFORM_DISTANCE = 300;
const MIN_STAIR_HEIGHT = 20; const MAX_STAIR_HEIGHT = 80;
const PERFECT_LANDING_MARGIN = 0.20;
const MAX_CHARGE_POWER = 10;
const CANCEL_HOLD_FRAMES = 120;

// --- OYUN DURUM DEĞİŞKENLERİ ---
let player, platforms, particles;
let score, lives, combo;
let isCharging, chargePower;
let isGameOver;
let cameraOffsetX, cameraOffsetY;
let floatingTexts;
let isPreviewing = false;
let fullPowerHoldTimer = 0;
let nextColorChangeScore = 10;
let currentGradientIndex = 0;
let activeBgLayerIndex = 0; // YENİ: Hangi katmanın aktif olduğunu takip et (0 veya 1)

const keys = { space: false };

// --- SINIFLAR (Player, Platform, Particle, FloatingText) 
class Player {
    constructor(x, y) { this.x = x; this.y = y; this.width = 30; this.height = 30; this.color = '#FF6347'; this.shadowColor = 'rgba(0, 0, 0, 0.3)'; this.vx = 0; this.vy = 0; this.isJumping = false; }
    draw() { ctx.shadowColor = this.shadowColor; ctx.shadowBlur = 10; ctx.shadowOffsetX = 5; ctx.shadowOffsetY = 5; ctx.fillStyle = this.color; ctx.fillRect(this.x, this.y, this.width, this.height); ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; }
    update() { if (this.isJumping) { this.x += this.vx; this.y += this.vy; this.vy += GRAVITY; } }
    jump(power) {
        if (!this.isJumping) {
            this.vy = -power * 1.5; this.vx = power * 1.020; this.isJumping = true;
            spawnParticles(this.x + this.width / 2, this.y + this.height, 15, '#ffffff', 'jump');
        }
    }
}
class Platform {
    constructor(x, y, width) { this.x = x; this.y = y; this.width = width; this.height = 20; this.shadowColor = 'rgba(0, 0, 0, 0.4)'; }
    draw() { ctx.shadowColor = this.shadowColor; ctx.shadowBlur = 15; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 8; const grad = ctx.createLinearGradient(this.x, this.y, this.x, this.y + this.height); grad.addColorStop(0, '#6A82FB'); grad.addColorStop(1, '#FC5C7D'); ctx.fillStyle = grad; ctx.fillRect(this.x, this.y, this.width, this.height); ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; }
}
class Particle {
    constructor(x, y, color, type) { this.x = x; this.y = y; this.color = color; this.size = Math.random() * 5 + 2; this.life = 100; if (type === 'jump') { this.vx = Math.random() * 4 - 2; this.vy = Math.random() * 4 - 2; } else { this.vx = Math.random() * 6 - 3; this.vy = -Math.random() * 5 - 2; } }
    update() { this.x += this.vx; this.y += this.vy; this.life -= 1.5; this.size *= 0.97; }
    draw() { ctx.globalAlpha = this.life / 100; ctx.fillStyle = this.color; ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1.0; }
}
function spawnParticles(x, y, count, color, type) { for (let i = 0; i < count; i++) { particles.push(new Particle(x, y, color, type)); } }
class FloatingText {
    constructor(text, x, y, color) { this.text = text; this.x = x; this.y = y; this.color = color; this.life = 60; this.opacity = 1; }
    update() { this.y -= 1; this.life--; this.opacity = this.life / 60; }
    draw() { ctx.save(); ctx.font = '24px Poppins'; ctx.fillStyle = `rgba(${this.color}, ${this.opacity})`; ctx.textAlign = 'center'; ctx.fillText(this.text, this.x, this.y); ctx.restore(); }
}

// Arka Plan Değiştirme Fonksiyonu (Cross-fade Mantığı)
function changeBackground() {
    let newIndex;
    do { newIndex = Math.floor(Math.random() * 6); }
    while (newIndex === currentGradientIndex);
    const hiddenLayer = bgLayers[1 - activeBgLayerIndex];
    hiddenLayer.className = `bg-gradient gradient-${newIndex}`;
    bgLayers[activeBgLayerIndex].style.opacity = '0'; 
    hiddenLayer.style.opacity = '1';                   
    activeBgLayerIndex = 1 - activeBgLayerIndex; 
    currentGradientIndex = newIndex;
}

// --- OYUNU BAŞLATMA VE SIFIRLAMA ---
function init() {
    score = 0; lives = 3; combo = 0; isCharging = false;
    chargePower = 0; isGameOver = false; cameraOffsetX = 0;
    cameraOffsetY = 0; floatingTexts = []; fullPowerHoldTimer = 0;
    particles = []; platforms = []; nextColorChangeScore = 10;
    const firstPlatform = new Platform(50, canvas.height - 100, 100);
    platforms.push(firstPlatform); addNewPlatform();
    player = new Player(firstPlatform.x + firstPlatform.width / 2 - 15, firstPlatform.y - 30);
    updateUI();
    gameOverScreen.style.display = 'none';
    previewButton.classList.remove('active'); isPreviewing = false;
    
    currentGradientIndex = 0;
    activeBgLayerIndex = 0;
    bgLayers[0].className = 'bg-gradient gradient-0';
    bgLayers[0].style.opacity = '1';
    bgLayers[1].style.opacity = '0';

    gameLoop();
}

// --- DİĞER FONKSİYONLAR 
function addNewPlatform() { const last = platforms[platforms.length - 1]; const hDist = MIN_PLATFORM_DISTANCE + Math.random() * (MAX_PLATFORM_DISTANCE - MIN_PLATFORM_DISTANCE); const nX = last.x + last.width + hDist; const vDist = MIN_STAIR_HEIGHT + Math.random() * (MAX_STAIR_HEIGHT - MIN_STAIR_HEIGHT); const nY = last.y - vDist; const nW = 120 + Math.random() * 80; platforms.push(new Platform(nX, nY, nW)); }
function cancelCharge() { isCharging = false; chargePower = 0; fullPowerHoldTimer = 0; }
function drawPowerBar() { if (isCharging) { const barW = 50; const barH = 10; const x = player.x + player.width / 2 - barW / 2; const y = player.y - 20; ctx.fillStyle = '#ddd'; ctx.fillRect(x, y, barW, barH); const pW = (chargePower / MAX_CHARGE_POWER) * barW; if (chargePower >= MAX_CHARGE_POWER && fullPowerHoldTimer > 0) { ctx.fillStyle = `hsl(60, 100%, 50%)`; } else { const hue = 120 - (chargePower / MAX_CHARGE_POWER) * 120; ctx.fillStyle = `hsl(${hue}, 100%, 50%)`; } ctx.fillRect(x, y, pW, barH); } }
function drawTrajectoryPreview() { let pVx = chargePower * 1.020; let pVy = -chargePower * 1.5; let pX = player.x + player.width / 2; let pY = player.y + player.height / 2; ctx.save(); ctx.beginPath(); ctx.moveTo(pX, pY); ctx.strokeStyle = 'yellow'; ctx.lineWidth = 4; ctx.setLineDash([15, 5]); ctx.shadowColor = 'rgba(0, 0, 0, 0.8)'; ctx.shadowBlur = 6; for (let i = 0; i < 120; i++) { pX += pVx; pY += pVy; pVy += GRAVITY; if (i % 3 === 0) { ctx.lineTo(pX, pY); } } ctx.stroke(); ctx.restore(); }
function updateUI() { scoreEl.textContent = score; comboEl.textContent = `x${combo}`; livesEl.innerHTML = '❤️'.repeat(lives); }
function handleInput() { if (keys.space && !player.isJumping && !isCharging) { isCharging = true; chargePower = 0; fullPowerHoldTimer = 0; } if (!keys.space && isCharging) { isCharging = false; player.jump(chargePower); chargePower = 0; fullPowerHoldTimer = 0; } }

// --- OYUN DÖNGÜSÜ ---
function gameLoop() {
    if (isGameOver) return;
    handleInput();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const targetCamX = player.x - canvas.width * 0.3; const targetCamY = player.y - canvas.height * 0.7;
    cameraOffsetX += (targetCamX - cameraOffsetX) * 0.1; cameraOffsetY += (targetCamY - cameraOffsetY) * 0.1;
    ctx.save();
    ctx.translate(-cameraOffsetX, -cameraOffsetY);
    particles.forEach((p, i) => { p.update(); p.draw(); if (p.life <= 0) particles.splice(i, 1); });
    player.update(); player.draw();
    platforms.forEach(p => p.draw());
    drawPowerBar();
    if (isPreviewing && isCharging) { drawTrajectoryPreview(); }
    floatingTexts.forEach((text, i) => { text.update(); text.draw(); if (text.life <= 0) floatingTexts.splice(i, 1); });
    ctx.restore();
    if (isCharging) { if (chargePower < MAX_CHARGE_POWER) { chargePower += 0.15; if (chargePower >= MAX_CHARGE_POWER) { chargePower = MAX_CHARGE_POWER; fullPowerHoldTimer = 1; } } else { fullPowerHoldTimer++; if (fullPowerHoldTimer > CANCEL_HOLD_FRAMES) { cancelCharge(); } } }
    checkCollision();
    if (platforms.length > 5 && platforms[0].x < cameraOffsetX - platforms[0].width) { platforms.shift(); }
    requestAnimationFrame(gameLoop);
}

// --- ÇARPIŞMA KONTROLÜ ---
function checkCollision() {
    if (player.isJumping && player.vy > 0) {
        const targetPlatform = platforms[1];
        if (targetPlatform && player.x + player.width > targetPlatform.x && player.x < targetPlatform.x + targetPlatform.width && player.y + player.height > targetPlatform.y && player.y + player.height < targetPlatform.y + 20) {
            player.isJumping = false; player.vx = 0; player.vy = 0; player.y = targetPlatform.y - player.height;
            const playerCenter = player.x + player.width / 2; const platformCenter = targetPlatform.x + targetPlatform.width / 2;
            const perfectMargin = targetPlatform.width * PERFECT_LANDING_MARGIN / 2;
            if (Math.abs(playerCenter - platformCenter) <= perfectMargin) {
                combo++; const bonus = 1 + combo; score += bonus;
                floatingTexts.push(new FloatingText(`PERFECT! +${bonus}`, player.x + 15, player.y, '255, 215, 0'));
                spawnParticles(player.x + player.width / 2, player.y + player.height, 25, 'gold', 'perfect');
            } else {
                combo = 0; score++;
                floatingTexts.push(new FloatingText('+1', player.x + 15, player.y, '255, 255, 255'));
            }
            if (score >= nextColorChangeScore) { changeBackground(); nextColorChangeScore += 10; }
            platforms.shift(); addNewPlatform(); updateUI();
        }
    }
    if (player.y > cameraOffsetY + canvas.height) { lives--; combo = 0; if (lives > 0) { player.isJumping = false; player.vx = 0; player.vy = 0; player.x = platforms[0].x + platforms[0].width / 2 - player.width / 2; player.y = platforms[0].y - player.height; cameraOffsetX = player.x - canvas.width * 0.3; cameraOffsetY = player.y - canvas.height * 0.7; } else { isGameOver = true; gameOverScreen.style.display = 'flex'; } updateUI(); }
}

// --- KONTROLLER ---
previewButton.addEventListener('click', () => { isPreviewing = !isPreviewing; previewButton.classList.toggle('active', isPreviewing); });
previewButton.addEventListener('mousedown', (e) => e.stopPropagation()); previewButton.addEventListener('mouseup', (e) => e.stopPropagation());
previewButton.addEventListener('touchstart', (e) => e.stopPropagation()); previewButton.addEventListener('touchend', (e) => e.stopPropagation());

// DEĞİŞTİ: Tıklama ve dokunma olayları artık oyun bittiğinde yeniden başlatıyor.
window.addEventListener('mousedown', (e) => {
    if (isGameOver) {
        init();
        return; // Oyun bittiyse başka işlem yapma
    }
    if (e.target === canvas) keys.space = true;
});

window.addEventListener('mouseup', () => {
    keys.space = false;
});

window.addEventListener('touchstart', (e) => {
    if (isGameOver) {
        init();
        return; // Oyun bittiyse başka işlem yapma
    }
    if (e.target === canvas) keys.space = true;
});

window.addEventListener('touchend', () => {
    keys.space = false;
});


// DEĞİŞTİ: Klavye olayları artık oyun bittiğinde herhangi bir tuşla yeniden başlatıyor.
window.addEventListener('keydown', (e) => {
    if (isGameOver) {
        init(); // Oyun bittiyse herhangi bir tuş yeniden başlatır
        return;
    }
    if (e.code === 'Space') keys.space = true;
});

window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') keys.space = false;
});

init();

const gameWrapper = document.getElementById('game-wrapper');

function resizeGame() {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const gameWidth = 800;
    const gameHeight = 600;

    // Ekrana sığacak en uygun ölçek oranını hesapla
    const scale = Math.min(screenWidth / gameWidth, screenHeight / gameHeight);

    
    // translate(-50%, -50%) kuralı, wrapper'ın kendi merkezini CSS'deki top: 50%; left: 50%; noktasına hizalar.
    // Bu, her durumda mükemmel ortalamayı garanti eder.
    gameWrapper.style.transform = `translate(-50%, -50%) scale(${scale})`;
}

// Sayfa yüklendiğinde ve pencere yeniden boyutlandırıldığında fonksiyonu çalıştır
window.addEventListener('resize', resizeGame);
window.addEventListener('load', resizeGame);
