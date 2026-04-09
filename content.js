// content.js - 内容脚本，负责页面表单填充逻辑

(function() {
  'use strict';

  // 防止重复注入
  if (window.__resumeFillerInjected) return;
  window.__resumeFillerInjected = true;

  // 配置数据缓存
  let fillItems = [];
  let autoFillMode = true;
  let manualFillMode = true;
  let currentDropdown = null;

  // 初始化
  init();

  async function init() {
    // 加载配置
    await loadConfig();
    
    // 监听来自popup的消息
    chrome.runtime.onMessage.addListener(handleMessage);
    
    // 设置页面事件监听
    setupPageListeners();
  }

  // 加载配置
  async function loadConfig() {
    try {
      const result = await chrome.storage.local.get(['fillItems', 'autoFillMode', 'manualFillMode']);
      fillItems = result.fillItems || getDefaultFillItems();
      autoFillMode = result.autoFillMode !== false;
      manualFillMode = result.manualFillMode !== false;

      // 如果是首次使用，保存默认配置
      if (!result.fillItems) {
        await chrome.storage.local.set({ fillItems });
      }
    } catch (error) {
      console.error('加载配置失败:', error);
      fillItems = getDefaultFillItems();
    }
  }

  // 获取默认填充项
  function getDefaultFillItems() {
    return [
      {
        id: '1',
        keywords: ['姓名', '名字', '您的称呼', '真实姓名', '联系人'],
        value: '张三'
      },
      {
        id: '2',
        keywords: ['手机', '手机号', '电话', '联系电话', '移动电话', '手机号码'],
        value: '13800138000'
      },
      {
        id: '3',
        keywords: ['邮箱', 'email', '电子邮箱', 'E-mail', '邮件地址'],
        value: 'zhangsan@example.com'
      },
      {
        id: '4',
        keywords: ['学历', '最高学历', '教育程度'],
        value: '本科'
      },
      {
        id: '5',
        keywords: ['毕业院校', '学校', '院校', '毕业学校', '大学'],
        value: '北京大学'
      },
      {
        id: '6',
        keywords: ['专业', '所学专业', '主修专业'],
        value: '计算机科学与技术'
      },
      {
        id: '7',
        keywords: ['工作经历', '工作经验', '工作年限'],
        value: '5年互联网行业工作经验'
      },
      {
        id: '8',
        keywords: ['地址', '家庭住址', '居住地址', '通讯地址', '详细地址'],
        value: '北京市海淀区中关村大街1号'
      },
      {
        id: '9',
        keywords: ['性别', '男/女'],
        value: '男'
      },
      {
        id: '10',
        keywords: ['年龄', '周岁'],
        value: '28'
      },
      {
        id: '11',
        keywords: ['期望薪资', '薪资要求', '期望工资', '月薪要求'],
        value: '面议'
      },
      {
        id: '12',
        keywords: ['求职意向', '应聘职位', '期望职位', '意向岗位'],
        value: '高级前端工程师'
      }
    ];
  }

  // 处理消息
  function handleMessage(request, sender, sendResponse) {
    switch (request.action) {
      case 'autoFill':
        handleAutoFill().then(result => {
          sendResponse(result);
        }).catch(error => {
          sendResponse({ success: false, message: error.message });
        });
        return true; // 保持消息通道开放

      case 'modeChanged':
        loadConfig();
        sendResponse({ success: true });
        break;

      case 'configUpdated':
        loadConfig();
        sendResponse({ success: true });
        break;
    }
  }

  // 设置页面事件监听
  function setupPageListeners() {
    // 监听输入框焦点事件（手动填充模式）
    document.addEventListener('focus', handleInputFocus, true);

    // 监听失焦事件，解除关闭标记
    document.addEventListener('blur', (event) => {
        const target = event.target;
        // 如果失去焦点的元素带有我们的标记，清除它
        if (target && target.dataset && target.dataset.rfClosed === 'true') {
            delete target.dataset.rfClosed;
        }
    }, true); 
    // 注意：这里也是用 true (捕获阶段)，和 focus 保持一致
    
    // 监听点击事件（关闭下拉菜单）
    document.addEventListener('click', handleDocumentClick, true);
    
    // 监听滚动事件（更新下拉菜单位置）
    document.addEventListener('scroll', handleScroll, true);
  }

  // 处理输入框焦点
  function handleInputFocus(event) {
    if (!manualFillMode) return;

    const target = event.target;

    // 拦截被手动关闭的输入框
    if (target.dataset.rfClosed === 'true') {
        return; 
    }
    
    // 检查是否是可输入元素
    if (!isInputElement(target)) return;

    // 检查是否是伪下拉框元素（核心拦截）
    if (isPseudoDropdownElement(target)) {
      return;
    }

    // 移除之前的下拉菜单
    removeDropdown();

    // 获取匹配的填充项
    const matches = findMatchingItems(target);
    
    if (matches.length > 0) {
      // 延迟显示下拉菜单，避免与点击事件冲突
      // 同时给网页自身的下拉组件一点时间弹出
      setTimeout(() => {
        // 再次检查是否出现了网页自身的下拉组件
        if (hasDropdownCompanion(target)) {
          return;
        }
        
        if (document.activeElement === target) {
          showDropdown(target, matches);
        }
      }, 150);
    }
  }

  // 处理文档点击
  function handleDocumentClick(event) {
    // 如果点击的不是下拉菜单，则关闭
    if (currentDropdown && !currentDropdown.contains(event.target)) {
      removeDropdown();
    }
  }

  // 处理滚动
  function handleScroll() {
    if (currentDropdown) {
      removeDropdown();
    }
  }

  // 检查是否是输入元素
  function isInputElement(element) {
    if (element.tagName === 'INPUT') {
      const type = element.type.toLowerCase();
      return ['text', 'email', 'tel', 'number', 'password', 'search', 'url', ''].includes(type);
    }
    if (element.tagName === 'TEXTAREA') return true;
    if (element.isContentEditable || element.contentEditable === 'true') return true;
    return false;
  }

  // 检查是否是伪下拉框元素（核心拦截逻辑）
  function isPseudoDropdownElement(element) {
    // 1. 原生 select 标签拦截
    if (element.tagName === 'SELECT') {
      return true;
    }

    // 2. 只读/不可输入拦截
    // 大多数伪下拉框的 input 都是只读的，只负责显示选中的文本
    if (element.tagName === 'INPUT') {
      if (element.readOnly || element.getAttribute('readonly') !== null) {
        return true;
      }
      if (element.getAttribute('contenteditable') === 'false') {
        return true;
      }
    }

    // 3. 特定 class 拦截
    // 检测常见的下拉组件特征类名
    if (hasDropdownClass(element)) {
      return true;
    }

    // 4. 伴随元素拦截
    // 检查紧邻范围内是否出现了具有"下拉容器"特征的元素
    if (hasDropdownCompanion(element)) {
      return true;
    }

    return false;
  }

  // 检测特定 class（下拉组件特征类名）
  function hasDropdownClass(element) {
    const dropdownKeywords = [
      'dropdown', 'select', 'picker', 'options', 'combobox',
      'autocomplete', 'suggest', 'calendar', 'date-picker',
      'time-picker', 'cascader', 'multiselect', 'selector'
    ];

    // 检查元素自身的 class
    const elementClass = (element.className || '').toLowerCase();
    for (const keyword of dropdownKeywords) {
      if (elementClass.includes(keyword)) {
        return true;
      }
    }

    // 检查父元素的 class（很多下拉框是包裹在一个容器内的）
    let parent = element.parentElement;
    let depth = 0;
    while (parent && depth < 3) {
      const parentClass = (parent.className || '').toLowerCase();
      for (const keyword of dropdownKeywords) {
        if (parentClass.includes(keyword)) {
          return true;
        }
      }
      parent = parent.parentElement;
      depth++;
    }

    return false;
  }

  // 检测伴随下拉元素
  function hasDropdownCompanion(element) {
    // 常见的下拉容器特征
    const dropdownSelectors = [
      '[role="listbox"]',
      '[role="combobox"]',
      '[role="list"]',
      '[role="menu"]',
      '[role="dialog"]',
      '[data-dropdown]',
      '[data-select]',
      '[data-picker]'
    ];

    // 检查兄弟元素
    let sibling = element.nextElementSibling;
    let siblingCount = 0;
    while (sibling && siblingCount < 5) {
      // 检查 role 属性
      const role = sibling.getAttribute('role');
      if (role && ['listbox', 'combobox', 'list', 'menu', 'dialog'].includes(role)) {
        return true;
      }

      // 检查是否是可见的绝对定位元素（可能是下拉面板）
      const style = window.getComputedStyle(sibling);
      if (style.position === 'absolute' || style.position === 'fixed') {
        const zIndex = parseInt(style.zIndex) || 0;
        if (zIndex > 100 && sibling.offsetHeight > 0) {
          // 检查是否包含列表项
          if (sibling.querySelector('[role="option"]') || 
              sibling.querySelector('li') ||
              sibling.querySelector('[class*="option"]') ||
              sibling.querySelector('[class*="item"]')) {
            return true;
          }
        }
      }

      sibling = sibling.nextElementSibling;
      siblingCount++;
    }

    // 检查父容器内是否有下拉面板
    const container = element.closest('div, span, section');
    if (container) {
      for (const selector of dropdownSelectors) {
        const dropdown = container.querySelector(selector);
        if (dropdown && dropdown !== element) {
          // 检查下拉面板是否可见
          const style = window.getComputedStyle(dropdown);
          if (style.display !== 'none' && style.visibility !== 'hidden') {
            return true;
          }
        }
      }
    }

    return false;
  }

  // 查找匹配的填充项
  function findMatchingItems(element) {
    const context = getElementContext(element);
    const matches = [];

    for (const item of fillItems) {
      for (const keyword of item.keywords) {
        const keywordLower = keyword.toLowerCase();
        for (const ctx of context) {
          if (ctx.toLowerCase().includes(keywordLower) || keywordLower.includes(ctx.toLowerCase())) {
            if (!matches.find(m => m.id === item.id)) {
              matches.push(item);
            }
            break;
          }
        }
      }
    }

    return matches;
  }

  // 获取元素的上下文信息
  function getElementContext(element) {
    const context = new Set();

    // 1. placeholder属性
    if (element.placeholder) {
      context.add(element.placeholder);
    }

    // 2. name属性
    if (element.name) {
      context.add(element.name);
    }

    // 3. id属性
    if (element.id) {
      context.add(element.id);
    }

    // 4. aria-label属性
    if (element.getAttribute('aria-label')) {
      context.add(element.getAttribute('aria-label'));
    }

    // 5. title属性
    if (element.title) {
      context.add(element.title);
    }

    // 6. 查找关联的label
    const labels = findLabels(element);
    labels.forEach(label => {
      const text = label.textContent?.trim();
      if (text) context.add(text);
    });

    // 7. 父元素和兄弟元素的文本
    const parentText = getParentText(element);
    parentText.forEach(text => context.add(text));

    // 8. 前一个兄弟元素的文本
    const prevSibling = element.previousElementSibling;
    if (prevSibling) {
      const text = prevSibling.textContent?.trim();
      if (text && text.length < 50) {
        context.add(text);
      }
    }

    return Array.from(context).filter(c => c.length > 0);
  }

  // 查找关联的label元素
  function findLabels(element) {
    const labels = [];

    // 通过for属性查找
    if (element.id) {
      const label = document.querySelector(`label[for="${element.id}"]`);
      if (label) labels.push(label);
    }

    // 查找父级label
    let parent = element.parentElement;
    while (parent) {
      if (parent.tagName === 'LABEL') {
        labels.push(parent);
        break;
      }
      parent = parent.parentElement;
    }

    // 查找相邻的label
    const container = element.closest('div, li, td, th, section, article');
    if (container) {
      const containerLabels = container.querySelectorAll('label');
      containerLabels.forEach(label => {
        if (!labels.includes(label)) {
          labels.push(label);
        }
      });
    }

    return labels;
  }

  // 获取父元素相关文本
  function getParentText(element) {
    const texts = [];
    let parent = element.parentElement;
    let depth = 0;

    while (parent && depth < 3) {
      // 获取直接子元素中的文本节点
      for (const child of parent.children) {
        if (child !== element && !child.contains(element)) {
          const text = child.textContent?.trim();
          if (text && text.length < 100) {
            texts.push(text);
          }
        }
      }
      
      parent = parent.parentElement;
      depth++;
    }

    return texts;
  }

  // 显示下拉菜单
  function showDropdown(inputElement, matches) {
    removeDropdown();

    const dropdown = document.createElement('div');
    dropdown.className = 'rf-dropdown';
    dropdown.id = 'resume-filler-dropdown';

    // 创建关闭按钮（右上角）
    const closeBtn = document.createElement('button');
    closeBtn.className = 'rf-dropdown-close';
    closeBtn.type = 'button';
    closeBtn.title = '关闭';
    closeBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    `;
    
    // 关闭按钮点击事件（关键：阻止事件冒泡，防止触发输入框失焦）
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      // 打上“已手动关闭”的标记
      inputElement.dataset.rfClosed = 'true';
      removeDropdown();
      // 关闭后重新聚焦输入框，让用户可以继续编辑
      // inputElement.focus();
    });
    
    // 阻止关闭按钮的 mousedown 事件冒泡（防止触发输入框失焦）
    closeBtn.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });

    dropdown.appendChild(closeBtn);

    // 创建下拉菜单内容
    const header = document.createElement('div');
    header.className = 'rf-dropdown-header';
    header.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="18" height="18" rx="2" stroke="#0078d4" stroke-width="2"/>
        <path d="M7 8h10M7 12h10M7 16h6" stroke="#0078d4" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <span>简历填充助手</span>
    `;
    dropdown.appendChild(header);

    const list = document.createElement('div');
    list.className = 'rf-dropdown-list';

    matches.forEach(item => {
      const option = document.createElement('div');
      option.className = 'rf-dropdown-option';
      option.innerHTML = `
        <div class="rf-option-title">${escapeHtml(item.keywords[0])}</div>
        <div class="rf-option-value">${escapeHtml(item.value)}</div>
      `;
      
      option.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        fillElement(inputElement, item.value);
        removeDropdown();
      });

      option.addEventListener('mouseenter', () => {
        option.classList.add('rf-option-hover');
      });

      option.addEventListener('mouseleave', () => {
        option.classList.remove('rf-option-hover');
      });

      list.appendChild(option);
    });

    dropdown.appendChild(list);

    // 计算位置
    const rect = inputElement.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

    dropdown.style.position = 'absolute';
    dropdown.style.left = `${rect.left + scrollLeft}px`;
    dropdown.style.top = `${rect.bottom + scrollTop + 4}px`;
    dropdown.style.minWidth = `${Math.max(rect.width, 250)}px`;
    dropdown.style.zIndex = '2147483647';

    document.body.appendChild(dropdown);
    currentDropdown = dropdown;

    // 确保下拉菜单在视口内
    requestAnimationFrame(() => {
      const dropdownRect = dropdown.getBoundingClientRect();
      if (dropdownRect.bottom > window.innerHeight) {
        dropdown.style.top = `${rect.top + scrollTop - dropdownRect.height - 4}px`;
      }
      if (dropdownRect.right > window.innerWidth) {
        dropdown.style.left = `${window.innerWidth - dropdownRect.width - 10 + scrollLeft}px`;
      }
    });
  }

  // 移除下拉菜单
  function removeDropdown() {
    if (currentDropdown) {
      currentDropdown.remove();
      currentDropdown = null;
    }
  }

  // 填充元素
  function fillElement(element, value) {
    if (element.isContentEditable || element.contentEditable === 'true') {
      element.textContent = value;
    } else {
      element.value = value;
    }

    // 触发事件
    triggerEvents(element);
  }

  // 触发输入事件
  function triggerEvents(element) {
    const events = ['input', 'change', 'blur'];
    
    events.forEach(eventType => {
      const event = new Event(eventType, {
        bubbles: true,
        cancelable: true
      });
      element.dispatchEvent(event);
    });

    // 对于React等框架，可能需要触发原生事件
    const inputEvent = new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: element.value
    });
    element.dispatchEvent(inputEvent);
  }

  // 处理自动填充
  async function handleAutoFill() {
    if (!autoFillMode) {
      return { success: false, message: '自动填充模式未启用' };
    }

    // 重新加载配置
    await loadConfig();

    // 查找所有可填充的输入元素
    const inputs = document.querySelectorAll('input, textarea, [contenteditable="true"]');
    let fillCount = 0;

    inputs.forEach(input => {
      if (!isInputElement(input)) return;
      if (input.type === 'hidden') return;
      if (input.disabled || input.readOnly) return;

      // 查找匹配项
      const matches = findMatchingItems(input);
      
      if (matches.length > 0) {
        // 使用第一个匹配项填充
        fillElement(input, matches[0].value);
        fillCount++;

        // 添加高亮效果
        highlightElement(input);
      }
    });

    return { success: true, count: fillCount };
  }

  // 高亮元素
  function highlightElement(element) {
    const originalBackground = element.style.backgroundColor;
    const originalTransition = element.style.transition;

    element.style.transition = 'background-color 0.3s ease';
    element.style.backgroundColor = '#e6f7ff';

    setTimeout(() => {
      element.style.backgroundColor = originalBackground;
      setTimeout(() => {
        element.style.transition = originalTransition;
      }, 300);
    }, 1000);
  }

  // HTML转义
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

})();
