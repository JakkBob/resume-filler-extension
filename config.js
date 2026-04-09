// config.js - 配置页面逻辑

document.addEventListener('DOMContentLoaded', async () => {
  // DOM 元素
  const itemsList = document.getElementById('itemsList');
  const emptyState = document.getElementById('emptyState');
  const searchInput = document.getElementById('searchInput');
  const addItemBtn = document.getElementById('addItemBtn');
  const importBtn = document.getElementById('importBtn');
  const exportBtn = document.getElementById('exportBtn');
  const importFile = document.getElementById('importFile');

  // 编辑弹窗
  const editModal = document.getElementById('editModal');
  const modalTitle = document.getElementById('modalTitle');
  const keywordsInput = document.getElementById('keywordsInput');
  const valueInput = document.getElementById('valueInput');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const saveBtn = document.getElementById('saveBtn');

  // 删除确认弹窗
  const confirmModal = document.getElementById('confirmModal');
  const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');

  // 提示消息
  const toast = document.getElementById('toast');

  // 数据
  let fillItems = [];
  let editingId = null;
  let deletingId = null;

  // 初始化
  await loadItems();
  renderItems();

  // 事件监听
  searchInput.addEventListener('input', handleSearch);
  addItemBtn.addEventListener('click', openAddModal);
  importBtn.addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', handleImport);
  exportBtn.addEventListener('click', handleExport);

  closeModalBtn.addEventListener('click', closeEditModal);
  cancelBtn.addEventListener('click', closeEditModal);
  saveBtn.addEventListener('click', saveItem);

  cancelDeleteBtn.addEventListener('click', closeConfirmModal);
  confirmDeleteBtn.addEventListener('click', confirmDelete);

  // 点击遮罩关闭弹窗
  editModal.querySelector('.modal-overlay').addEventListener('click', closeEditModal);
  confirmModal.querySelector('.modal-overlay').addEventListener('click', closeConfirmModal);

  // 键盘事件
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeEditModal();
      closeConfirmModal();
    }
  });

  // 加载配置项
  async function loadItems() {
    try {
      const result = await chrome.storage.local.get('fillItems');
      fillItems = result.fillItems || [];
    } catch (error) {
      console.error('加载配置失败:', error);
      fillItems = [];
    }
  }

  // 渲染配置项列表
  function renderItems(filter = '') {
    const filteredItems = filter
      ? fillItems.filter(item => 
          item.keywords.some(k => k.toLowerCase().includes(filter.toLowerCase())) ||
          item.value.toLowerCase().includes(filter.toLowerCase())
        )
      : fillItems;

    if (filteredItems.length === 0) {
      itemsList.innerHTML = '';
      emptyState.classList.remove('hidden');
      return;
    }

    emptyState.classList.add('hidden');
    itemsList.innerHTML = filteredItems.map(item => `
      <div class="item-card" data-id="${item.id}">
        <div class="item-content">
          <div class="item-keywords">
            ${item.keywords.map(k => `<span class="keyword-tag">${escapeHtml(k)}</span>`).join('')}
          </div>
          <div class="item-value">${escapeHtml(item.value)}</div>
        </div>
        <div class="item-actions">
          <button class="btn-icon edit-btn" title="编辑">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <button class="btn-icon delete-btn" title="删除">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    `).join('');

    // 绑定事件
    itemsList.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.closest('.item-card').dataset.id;
        openEditModal(id);
      });
    });

    itemsList.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.closest('.item-card').dataset.id;
        openConfirmModal(id);
      });
    });
  }

  // 搜索处理
  function handleSearch(e) {
    renderItems(e.target.value);
  }

  // 打开新增弹窗
  function openAddModal() {
    editingId = null;
    modalTitle.textContent = '新增填充项';
    keywordsInput.value = '';
    valueInput.value = '';
    editModal.classList.remove('hidden');
    keywordsInput.focus();
  }

  // 打开编辑弹窗
  function openEditModal(id) {
    const item = fillItems.find(i => i.id === id);
    if (!item) return;

    editingId = id;
    modalTitle.textContent = '编辑填充项';
    keywordsInput.value = item.keywords.join(', ');
    valueInput.value = item.value;
    editModal.classList.remove('hidden');
    keywordsInput.focus();
  }

  // 关闭编辑弹窗
  function closeEditModal() {
    editModal.classList.add('hidden');
    editingId = null;
  }

  // 保存配置项
  async function saveItem() {
    const keywordsText = keywordsInput.value.trim();
    const value = valueInput.value.trim();

    if (!keywordsText) {
      showToast('请输入关键词', 'error');
      keywordsInput.focus();
      return;
    }

    if (!value) {
      showToast('请输入填充值', 'error');
      valueInput.focus();
      return;
    }

    // 解析关键词（支持逗号和换行分隔）
    const keywords = keywordsText
      .split(/[,\n]/)
      .map(k => k.trim())
      .filter(k => k.length > 0);

    if (keywords.length === 0) {
      showToast('请输入有效的关键词', 'error');
      return;
    }

    if (editingId) {
      // 编辑模式
      const index = fillItems.findIndex(i => i.id === editingId);
      if (index !== -1) {
        fillItems[index] = {
          ...fillItems[index],
          keywords,
          value
        };
      }
    } else {
      // 新增模式
      const newItem = {
        id: Date.now().toString(),
        keywords,
        value
      };
      fillItems.push(newItem);
    }

    try {
      await chrome.storage.local.set({ fillItems });
      closeEditModal();
      renderItems(searchInput.value);
      showToast(editingId ? '修改成功' : '添加成功', 'success');
      
      // 通知content script配置已更新
      notifyConfigUpdated();
    } catch (error) {
      console.error('保存失败:', error);
      showToast('保存失败: ' + error.message, 'error');
    }
  }

  // 打开删除确认弹窗
  function openConfirmModal(id) {
    deletingId = id;
    confirmModal.classList.remove('hidden');
  }

  // 关闭删除确认弹窗
  function closeConfirmModal() {
    confirmModal.classList.add('hidden');
    deletingId = null;
  }

  // 确认删除
  async function confirmDelete() {
    if (!deletingId) return;

    fillItems = fillItems.filter(i => i.id !== deletingId);

    try {
      await chrome.storage.local.set({ fillItems });
      closeConfirmModal();
      renderItems(searchInput.value);
      showToast('删除成功', 'success');
      
      // 通知content script配置已更新
      notifyConfigUpdated();
    } catch (error) {
      console.error('删除失败:', error);
      showToast('删除失败: ' + error.message, 'error');
    }
  }

  // 导入配置
  async function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!Array.isArray(data)) {
        throw new Error('无效的配置文件格式');
      }

      // 验证数据格式
      for (const item of data) {
        if (!item.keywords || !Array.isArray(item.keywords) || !item.value) {
          throw new Error('配置项格式不正确');
        }
      }

      // 生成新ID
      const newItems = data.map((item, index) => ({
        id: item.id || Date.now().toString() + index,
        keywords: item.keywords,
        value: item.value
      }));

      fillItems = [...fillItems, ...newItems];
      await chrome.storage.local.set({ fillItems });
      renderItems();
      showToast(`成功导入 ${newItems.length} 个配置项`, 'success');
      
      // 通知content script配置已更新
      notifyConfigUpdated();
    } catch (error) {
      console.error('导入失败:', error);
      showToast('导入失败: ' + error.message, 'error');
    }

    // 清空文件选择
    e.target.value = '';
  }

  // 导出配置
  function handleExport() {
    if (fillItems.length === 0) {
      showToast('没有可导出的配置项', 'error');
      return;
    }

    const dataStr = JSON.stringify(fillItems, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `resume-filler-config-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('导出成功', 'success');
  }

  // 通知配置更新
  async function notifyConfigUpdated() {
    try {
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        try {
          await chrome.tabs.sendMessage(tab.id, { action: 'configUpdated' });
        } catch (e) {
          // 忽略无法发送的标签页
        }
      }
    } catch (error) {
      console.error('通知配置更新失败:', error);
    }
  }

  // 显示提示消息
  function showToast(message, type = 'info') {
    const messageSpan = toast.querySelector('.toast-message');
    messageSpan.textContent = message;
    toast.className = `toast ${type}`;

    setTimeout(() => {
      toast.classList.add('hidden');
    }, 3000);
  }

  // HTML转义
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
});
