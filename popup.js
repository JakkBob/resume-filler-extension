// popup.js - 弹窗页面逻辑

document.addEventListener('DOMContentLoaded', async () => {
  // DOM 元素
  const autoFillModeCheckbox = document.getElementById('autoFillMode');
  const manualFillModeCheckbox = document.getElementById('manualFillMode');
  const autoFillBtn = document.getElementById('autoFillBtn');
  const openConfigBtn = document.getElementById('openConfigBtn');
  const totalItemsSpan = document.getElementById('totalItems');
  const lastFillSpan = document.getElementById('lastFill');
  const statusToast = document.getElementById('statusToast');

  // 加载保存的模式设置
  await loadModeSettings();
  
  // 加载统计信息
  await loadStats();

  // 事件监听器
  autoFillModeCheckbox.addEventListener('change', () => {
    saveModeSettings();
    notifyContentScript('modeChanged');
  });

  manualFillModeCheckbox.addEventListener('change', () => {
    saveModeSettings();
    notifyContentScript('modeChanged');
  });

  autoFillBtn.addEventListener('click', async () => {
    const btn = autoFillBtn;
    btn.disabled = true;
    btn.innerHTML = `
      <svg class="spinner" width="16" height="16" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" stroke-dasharray="31.4" stroke-dashoffset="10">
          <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/>
        </circle>
      </svg>
      填充中...
    `;

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab) {
        showToast('无法获取当前标签页', 'error');
        return;
      }

      // 先注入content script（如果尚未注入）
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
      } catch (e) {
        // 可能已经注入，忽略错误
      }

      // 发送填充消息
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'autoFill' });
      
      if (response && response.success) {
        showToast(`成功填充 ${response.count} 个字段`, 'success');
        // 更新上次填充时间
        await chrome.storage.local.set({ lastFillTime: Date.now() });
        await loadStats();
      } else {
        showToast(response?.message || '填充失败', 'error');
      }
    } catch (error) {
      console.error('自动填充错误:', error);
      showToast('填充出错: ' + error.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M13 3v2h5.586l-6.293 6.293 1.414 1.414L20 6.414V12h2V3h-9zM4 21h17v-2H4V4H2v17a2 2 0 002 2z" fill="currentColor"/>
        </svg>
        一键自动填充
      `;
    }
  });

  openConfigBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('config.html') });
  });

  // 加载模式设置
  async function loadModeSettings() {
    try {
      const result = await chrome.storage.local.get(['autoFillMode', 'manualFillMode']);
      autoFillModeCheckbox.checked = result.autoFillMode !== false; // 默认开启
      manualFillModeCheckbox.checked = result.manualFillMode !== false; // 默认开启
    } catch (error) {
      console.error('加载模式设置失败:', error);
    }
  }

  // 保存模式设置
  async function saveModeSettings() {
    try {
      await chrome.storage.local.set({
        autoFillMode: autoFillModeCheckbox.checked,
        manualFillMode: manualFillModeCheckbox.checked
      });
    } catch (error) {
      console.error('保存模式设置失败:', error);
    }
  }

  // 加载统计信息
  async function loadStats() {
    try {
      const result = await chrome.storage.local.get(['fillItems', 'lastFillTime']);
      
      // 配置项数量
      const items = result.fillItems || [];
      totalItemsSpan.textContent = items.length;

      // 上次填充时间
      if (result.lastFillTime) {
        const now = Date.now();
        const diff = now - result.lastFillTime;
        
        if (diff < 60000) {
          lastFillSpan.textContent = '刚刚';
        } else if (diff < 3600000) {
          lastFillSpan.textContent = Math.floor(diff / 60000) + '分钟前';
        } else if (diff < 86400000) {
          lastFillSpan.textContent = Math.floor(diff / 3600000) + '小时前';
        } else {
          lastFillSpan.textContent = Math.floor(diff / 86400000) + '天前';
        }
      }
    } catch (error) {
      console.error('加载统计信息失败:', error);
    }
  }

  // 通知content script
  async function notifyContentScript(action) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        await chrome.tabs.sendMessage(tab.id, { action });
      }
    } catch (error) {
      // 忽略错误，可能content script尚未加载
    }
  }

  // 显示提示消息
  function showToast(message, type = 'info') {
    const toast = statusToast;
    const messageSpan = toast.querySelector('.toast-message');
    
    messageSpan.textContent = message;
    toast.className = `toast ${type}`;
    
    // 3秒后自动隐藏
    setTimeout(() => {
      toast.classList.add('hidden');
    }, 3000);
  }
});
