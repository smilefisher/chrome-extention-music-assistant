// 获取当前标签页中的音乐信息
function getCurrentTabMusicInfo() {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (!tabs || !tabs[0] || !tabs[0].id) {
      // 如果没有获取到标签页信息，尝试从本地存储加载上一次的音乐信息
      loadLastMusicInfo();
      return;
    }

    // 添加重试机制
    let retryCount = 0;
    const maxRetries = 3;

    function tryDetectMusic() {
      if (retryCount >= maxRetries) {
        loadLastMusicInfo();
        return;
      }
      chrome.tabs.sendMessage(tabs[0].id, {action: 'detectMusic'}, function(response) {
        if (chrome.runtime.lastError) {
          // 如果出现错误，尝试从本地存储加载上一次的音乐信息
          // 从本地存储加载上一次的音乐信息
          function loadLastMusicInfo() {
            chrome.storage.local.get(['lastMusicInfo'], function(result) {
              if (result.lastMusicInfo) {
                updateMusicInfo(result.lastMusicInfo);
              } else {
                const musicInfoDiv = document.getElementById('musicInfo');
                musicInfoDiv.innerHTML = '<div class="no-music">无法检测音乐：请刷新页面或重新打开扩展</div>';
              }
            });
          }
          retryCount++;
          setTimeout(tryDetectMusic, 1000);
          return;
        }
        const musicInfo = response ? response.musicInfo : [];
        // 如果检测到音乐，保存到本地存储
        if (musicInfo && musicInfo.length > 0) {
          chrome.storage.local.set({ lastMusicInfo: musicInfo });
        }
        updateMusicInfo(musicInfo);
      });
    }
    
    tryDetectMusic();
  });
}

// 更新音乐信息显示
function updateMusicInfo(musicInfo) {
  const musicInfoDiv = document.getElementById('musicInfo');
  const previewPlayer = document.getElementById('previewPlayer');
  
  if (!previewPlayer) {
    console.error('预览播放器元素未找到');
    return;
  }
  
  if (musicInfo.length === 0) {
    musicInfoDiv.innerHTML = '<div class="no-music">请刷新网页后，点击播放</div>';
    return;
  }

  let html = '';
  musicInfo.forEach(info => {
    const title = formatMusicTitle(info.title);
    const duration = formatTime(info.duration);
    const currentTime = formatTime(info.currentTime);
    
    html += `
      <div class="music-item">
        <h3>${title}</h3>
        <p>播放进度：${currentTime} / ${duration}</p>
        <p class="source-link">来源：<span title="${info.src}" class="music-src">${info.src}</span></p>
        <div class="audio-controls">
          <button class="play-btn" data-src="${info.src}">预览</button>
          <button class="download-btn" data-src="${info.src}" data-title="${title}">下载</button>
        </div>
      </div>
    `;
  });

  musicInfoDiv.innerHTML = html;

  // 添加预览按钮点击事件
  const playButtons = musicInfoDiv.querySelectorAll('.play-btn');
  playButtons.forEach(button => {
    button.addEventListener('click', function() {
      const audioSrc = this.getAttribute('data-src');
      if (previewPlayer.src === audioSrc && !previewPlayer.paused) {
        previewPlayer.pause();
        this.textContent = '预览';
      } else {
        previewPlayer.src = audioSrc;
        previewPlayer.play();
        // 重置其他按钮的文本
        playButtons.forEach(btn => btn.textContent = '预览');
        this.textContent = '暂停';
      }
    });
  });

  // 添加复制链接按钮点击事件
  const copyButtons = musicInfoDiv.querySelectorAll('.copy-btn');
  copyButtons.forEach(button => {
    button.addEventListener('click', function() {
      const audioSrc = this.getAttribute('data-src');
      navigator.clipboard.writeText(audioSrc).then(() => {
        const originalText = this.textContent;
        this.textContent = '已复制';
        setTimeout(() => {
          this.textContent = originalText;
        }, 2000);
      });
    });
  });

  // 监听音频播放结束事件
  previewPlayer.addEventListener('ended', function() {
    playButtons.forEach(btn => btn.textContent = '预览');
  });

  // 添加下载按钮点击事件
  const downloadButtons = musicInfoDiv.querySelectorAll('.download-btn');
  downloadButtons.forEach(button => {
    button.addEventListener('click', function() {
      const audioSrc = this.getAttribute('data-src');
      const title = this.getAttribute('data-title');
      chrome.downloads.download({
        url: audioSrc,
        filename: `${title}.mp3`,
        saveAs: true
      });
    });
  });
}

// 格式化音乐标题
function formatMusicTitle(title) {
  if (!title) return '背景音乐';
  
  // 支持更多音频格式
  const audioExtensions = /\.(mp3|wav|m4a|ogg|aac|flac|wma|opus|webm|mid|midi|amr|ape|au|aiff)$/i;
  
  // 尝试从文件名中提取更友好的标题
  if (audioExtensions.test(title)) {
    // 移除文件扩展名
    title = title.replace(audioExtensions, '');
    // 移除哈希值样式的字符串（如果存在）
    if (/^[a-f0-9]{32}$/i.test(title)) {
      const musicTypes = ['背景音乐', '音乐片段', '未命名音乐', '音频片段'];
      return musicTypes[Math.floor(Math.random() * musicTypes.length)];
    }
  }
  
  // 如果标题过长，截取合适长度
  if (title.length > 50) {
    title = title.substring(0, 47) + '...';
  }
  
  return title;
}

// 格式化时间
function formatTime(seconds) {
  if (!seconds) return '00:00';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

// 初始化
document.addEventListener('DOMContentLoaded', getCurrentTabMusicInfo);

// 监听音乐状态变化
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'musicStateChanged') {
    getCurrentTabMusicInfo();
  }
});