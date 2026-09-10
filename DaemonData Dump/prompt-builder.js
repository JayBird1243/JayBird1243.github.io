// Get Firebase instances from window (initialized in builder.html)
const auth = window.firebase.auth;
const db = window.firebase.firestore;

// Import Firebase functions
const { onAuthStateChanged } = window.firebase;
const { doc, getDoc, setDoc, updateDoc, collection, serverTimestamp } = window.firebase;

// Global state
let currentUser = null;
let promptId = null;
let promptData = null;
let blocks = {}; // Ordered map of blocks
let nextBlockOrder = 0;
let isDirty = false;
let promptTemplates = null;
let currentOpenSettings = null;
let pendingDeleteBlockId = null;

// Block type limits
const BLOCK_LIMITS = {
  bounds: 1,
  prompt_body: 50, // Increased limit as requested
  post_title: 1,
  post_body: 1,
  post_metadata: 1,
  examples: 5
};

// Initialize
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = '/auth.html';
    return;
  }
  currentUser = user;
  initBuilder();
});

async function initBuilder() {
  // Get prompt ID from URL
  const urlParams = new URLSearchParams(window.location.search);
  promptId = urlParams.get('id');
  
  // Load prompt templates
  await loadPromptTemplates();
  
  if (promptId) {
    // Load existing prompt
    await loadPrompt(promptId);
  } else {
    // Create new prompt
    await createNewPrompt();
  }
  
  // Initialize UI
  setupEventListeners();
  renderPromptStack();
  
  // Initialize Sortable
  setupSortable();
}

async function loadPromptTemplates() {
  try {
    const templatesDoc = await getDoc(doc(db, 'global-config', 'prompt-templates'));
    if (templatesDoc.exists()) {
      promptTemplates = templatesDoc.data();
    } else {
      console.error('Prompt templates not found');
      promptTemplates = { types: {}, exampleIntros: {} };
    }
  } catch (error) {
    console.error('Error loading prompt templates:', error);
    promptTemplates = { types: {}, exampleIntros: {} };
  }
}

async function loadPrompt(id) {
  try {
    const promptDoc = await getDoc(doc(db, `users/${currentUser.uid}/prompts`, id));
    if (promptDoc.exists()) {
      promptData = promptDoc.data();
      blocks = promptData.blocks || {};
      
      // Find the highest order number
      const orders = Object.keys(blocks).map(k => parseInt(k)).filter(n => !isNaN(n));
      nextBlockOrder = orders.length > 0 ? Math.max(...orders) + 1 : 0;
      
      // Update prompt name
      document.getElementById('promptName').value = promptData.name || '';
    } else {
      console.error('Prompt not found');
      await createNewPrompt();
    }
  } catch (error) {
    console.error('Error loading prompt:', error);
    await createNewPrompt();
  }
}

async function createNewPrompt() {
  // Generate new prompt ID
  const timestamp = Date.now();
  promptId = `prompt-${timestamp}`;
  
  // Create default blocks
  const boundsBlock = createBlock('bounds', {
    responseType: null,
    responseConfig: {}
  });
  
  const promptBodyBlock = createBlock('prompt_body', {
    text: ''
  });
  
  blocks = {
    0: boundsBlock,
    1: promptBodyBlock
  };
  nextBlockOrder = 2;
  
  promptData = {
    id: timestamp,
    name: 'New Prompt',
    description: '',
    responseType: 'unbounded_string',
    compiledPrompt: '',
    blocks: blocks,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  document.getElementById('promptName').value = promptData.name;
  markDirty();
}

function createBlock(type, config = {}) {
  return {
    id: generateBlockId(),
    type: type,
    config: config
  };
}

function generateBlockId() {
  return `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function setupEventListeners() {
  // Save button
  document.getElementById('saveBtn').addEventListener('click', savePrompt);
  
  // Prompt name change
  document.getElementById('promptName').addEventListener('input', (e) => {
    if (promptData) {
      promptData.name = e.target.value;
      markDirty();
    }
  });
  
  // View prompt button
  document.getElementById('viewPromptBtn').addEventListener('click', showCompiledPrompt);
  
  // Close modal
  document.getElementById('closeModal').addEventListener('click', () => {
    document.getElementById('viewPromptModal').classList.remove('show');
  });
  
  // Close settings
  document.getElementById('closeSettings').addEventListener('click', closeSettings);
  
  // Click outside settings to close
  document.getElementById('gridArea').addEventListener('click', (e) => {
    if (!e.target.closest('.prompt-block') && currentOpenSettings) {
      closeSettings();
    }
  });
  
  // Menu toggle
  document.getElementById('menuToggle').addEventListener('click', () => {
    document.getElementById('blockMenu').classList.toggle('collapsed');
    const icon = document.querySelector('#menuToggle i');
    if (icon) {
      const isCollapsed = document.getElementById('blockMenu').classList.contains('collapsed');
      icon.className = isCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left';
    }
  });
  
  // Grid panning functionality
  setupGridPanning();

  // Delete modal handlers
  const deleteModal = document.getElementById('deleteConfirmModal');
  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
  const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', () => {
      if (pendingDeleteBlockId) {
        performDeleteBlock(pendingDeleteBlockId);
        pendingDeleteBlockId = null;
      }
      if (deleteModal) deleteModal.classList.remove('show');
    });
  }
  if (cancelDeleteBtn) {
    cancelDeleteBtn.addEventListener('click', () => {
      pendingDeleteBlockId = null;
      if (deleteModal) deleteModal.classList.remove('show');
    });
  }

  // Description Modal Handlers
  const descModal = document.getElementById('descriptionModal');
  const editDescBtn = document.getElementById('editDescriptionBtn');
  const cancelDescBtn = document.getElementById('cancelDescriptionBtn');
  const saveDescBtn = document.getElementById('saveDescriptionBtn');

  if (editDescBtn) {
    editDescBtn.addEventListener('click', () => {
      document.getElementById('promptDescriptionInput').value = promptData?.description || '';
      if (descModal) descModal.classList.add('show');
    });
  }

  if (cancelDescBtn) {
    cancelDescBtn.addEventListener('click', () => {
      if (descModal) descModal.classList.remove('show');
    });
  }

  if (saveDescBtn) {
    saveDescBtn.addEventListener('click', async () => {
      const newDesc = document.getElementById('promptDescriptionInput').value;
      
      try {
        // Update local state
        if (promptData) {
          promptData.description = newDesc;
        }

        // Save to Firestore specific field
        const docRef = doc(db, `users/${currentUser.uid}/prompts`, promptId);
        await updateDoc(docRef, {
          description: newDesc,
          updatedAt: serverTimestamp()
        });
        
        showTooltip('Description saved successfully!', 'success');
        if (descModal) descModal.classList.remove('show');
      } catch (error) {
        console.error('Error saving description:', error);
        showTooltip('Error saving description: ' + error.message, 'error');
      }
    });
  }
}

function setupSortable() {
  // Sidebar Sortable
  new Sortable(document.getElementById('sidebarBlocks'), {
    group: {
      name: 'shared',
      pull: 'clone',
      put: false
    },
    sort: false,
    animation: 150,
    ghostClass: 'sortable-ghost',
    dragClass: 'sortable-drag'
  });

  // Prompt Stack Sortable
  new Sortable(document.getElementById('promptStack'), {
    group: 'shared',
    animation: 150,
    ghostClass: 'sortable-ghost',
    dragClass: 'sortable-drag',
    handle: '.prompt-block',
    filter: '.static-block', // Prevent dragging the bounds block
    onMove: function (evt) {
      // Prevent dropping before/swapping with the static bounds block
      if (evt.related.classList.contains('static-block')) {
        return false;
      }
    },
    onEnd: function (evt) {
      // Reorder happened within the list
      if (evt.oldIndex !== evt.newIndex) {
        handleReorder(evt.oldIndex, evt.newIndex);
      }
    },
    onAdd: function (evt) {
      // Item dropped from sidebar
      const itemEl = evt.item;
      const newIndex = evt.newIndex;
      const blockType = itemEl.dataset.blockType;
      
      // Remove the DOM element Sortable dropped, we will re-render from state
      itemEl.remove();
      
      addBlockToStackAt(blockType, newIndex);
    }
  });
}

function setupGridPanning() {
  const gridArea = document.getElementById('gridArea');
  let isPanning = false;
  let startX, startY;
  let startScrollLeft, startScrollTop;
  
  // Use mousedown on document to catch all clicks
  gridArea.addEventListener('mousedown', (e) => {
    // Don't pan if clicking on interactive elements
    if (e.target.closest('.prompt-block') || 
        e.target.closest('button') || 
        e.target.closest('input') ||
        e.target.closest('textarea') ||
        e.target.closest('select')) {
      return;
    }
    
    // Blur active input/textarea when clicking the grid to stop editing
    if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
      document.activeElement.blur();
    }
    
    isPanning = true;
    gridArea.style.cursor = 'grabbing';
    startX = e.clientX;
    startY = e.clientY;
    startScrollLeft = gridArea.scrollLeft;
    startScrollTop = gridArea.scrollTop;
    e.preventDefault();
  });
  
  document.addEventListener('mousemove', (e) => {
    if (!isPanning) return;
    e.preventDefault();
    
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    
    gridArea.scrollLeft = startScrollLeft - dx;
    gridArea.scrollTop = startScrollTop - dy;
  });
  
  document.addEventListener('mouseup', () => {
    if (isPanning) {
      isPanning = false;
      gridArea.style.cursor = 'grab';
    }
  });
  
  gridArea.addEventListener('mouseleave', () => {
    if (isPanning) {
      isPanning = false;
      gridArea.style.cursor = 'grab';
    }
  });
}

function handleReorder(oldIndex, newIndex) {
  // Get all blocks sorted by current order
  const sortedEntries = Object.entries(blocks).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
  
  // Extract the moved block
  const [movedOrderKey, movedBlock] = sortedEntries[oldIndex];
  
  // Remove it from the list
  const remainingBlocks = sortedEntries.filter((_, idx) => idx !== oldIndex).map(e => e[1]);
  
  // Insert at new position
  remainingBlocks.splice(newIndex, 0, movedBlock);
  
  // Rebuild blocks object with new keys
  const newBlocks = {};
  remainingBlocks.forEach((block, idx) => {
    newBlocks[idx] = block;
  });
  
  blocks = newBlocks;
  nextBlockOrder = remainingBlocks.length;
  
  markDirty();
  renderPromptStack();
}

function addBlockToStackAt(blockType, index) {
  // Check block limits
  const existingCount = Object.values(blocks).filter(b => b.type === blockType).length;
  if (existingCount >= BLOCK_LIMITS[blockType]) {
    showTooltip(`Maximum ${BLOCK_LIMITS[blockType]} ${blockType} block(s) allowed`);
    renderPromptStack(); // Re-render to fix any DOM changes Sortable made
    return;
  }
  
  const newBlock = createBlock(blockType, getDefaultConfig(blockType));
  
  // Get all blocks sorted by current order
  const sortedEntries = Object.entries(blocks).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
  const currentBlocks = sortedEntries.map(e => e[1]);
  
  // Insert new block
  currentBlocks.splice(index, 0, newBlock);
  
  // Rebuild blocks object
  const newBlocks = {};
  currentBlocks.forEach((block, idx) => {
    newBlocks[idx] = block;
  });
  
  blocks = newBlocks;
  nextBlockOrder = currentBlocks.length;
  
  markDirty();
  renderPromptStack();
}

function getDefaultConfig(blockType) {
  switch (blockType) {
    case 'bounds':
      return { responseType: null, responseConfig: {} };
    case 'examples':
      return { 
        postTitle: '', 
        postBody: '', 
        upvotes: 0, 
        comments: 0,
        expectedReturn: '',
        redditLink: ''
      };
    case 'prompt_body':
      return { text: '' };
    case 'post_title':
      return {};
    case 'post_body':
      return {};
    case 'post_metadata':
      return { showUpvotes: true, showComments: true, showSubreddit: true };
    default:
      return {};
  }
}

function renderPromptStack() {
  const stackContainer = document.getElementById('promptStack');
  stackContainer.innerHTML = '';
  
  // Sort blocks by order
  const sortedBlocks = Object.entries(blocks).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
  
  sortedBlocks.forEach(([order, block], index) => {
    const blockEl = createBlockElement(block, order, index, sortedBlocks.length);
    stackContainer.appendChild(blockEl);
  });
}

function createBlockElement(block, order, index, totalBlocks) {
  const div = document.createElement('div');
  // New Design classes: glass-card, block-accent
  div.className = `prompt-block glass-card in-stack mb-4 block-accent-${block.type}`;
  div.dataset.blockId = block.id;
  div.dataset.blockOrder = order;
  div.dataset.blockType = block.type;
  
  // Lock bounds block
  if (block.type === 'bounds') {
    div.classList.add('static-block');
    // div.classList.add('bounds-header'); // Removed specific shape class, let glass-card handle it
  }
  
  // Block content
  const title = getBlockTitle(block);
  const preview = getBlockPreview(block);
  
  div.innerHTML = `
    <div class="flex justify-between items-start relative z-10">
      <div class="flex-1">
        <div class="font-bold text-gray-100 mb-1 font-heading text-lg tracking-wide">${title}</div>
        <div class="text-xs text-gray-400 font-mono">${preview}</div>
      </div>
      ${block.type !== 'bounds' ? `
        <button class="delete-block ml-4 text-gray-600 hover:text-red-500 transition-colors p-1" data-block-id="${block.id}">
          <i class="fas fa-trash-alt"></i>
        </button>
      ` : `
        <div class="text-xs font-bold text-gray-600 uppercase tracking-widest px-2 py-1 border border-gray-700 rounded">System</div>
      `}
    </div>
  `;
  
  // Click to open settings
  div.addEventListener('click', (e) => {
    if (!e.target.closest('.delete-block')) {
      openBlockSettings(block.id);
    }
  });
  
  // Delete block
  const deleteBtn = div.querySelector('.delete-block');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showDeleteModal(block.id);
    });
  }
  
  return div;
}

function showDeleteModal(blockId) {
  pendingDeleteBlockId = blockId;
  const modal = document.getElementById('deleteConfirmModal');
  if (modal) modal.classList.add('show');
}

function performDeleteBlock(blockId) {
  // Find and remove the block
  const orderKey = Object.entries(blocks).find(([_, b]) => b.id === blockId)?.[0];
  if (orderKey) {
    delete blocks[orderKey];
    
    // Re-index blocks to avoid holes
    const sortedBlocks = Object.entries(blocks).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).map(e => e[1]);
    const newBlocks = {};
    sortedBlocks.forEach((block, idx) => {
      newBlocks[idx] = block;
    });
    blocks = newBlocks;
    nextBlockOrder = sortedBlocks.length;

    markDirty();
    renderPromptStack();
    if (currentOpenSettings === blockId) {
      closeSettings();
    }
  }
}

function getBlockTitle(block) {
  const titles = {
    bounds: 'RESPONSE BOUNDS',
    examples: 'FEW-SHOT EXAMPLES',
    prompt_body: 'PROMPT BODY',
    post_title: 'POST TITLE INSERT',
    post_body: 'POST BODY INSERT',
    post_metadata: 'POST METADATA'
  };
  return titles[block.type] || block.type.toUpperCase();
}

function getBlockPreview(block) {
  switch (block.type) {
    case 'bounds':
      if (!block.config.responseType) {
        return 'Configuration required';
      }
      return `Type: ${formatResponseType(block.config.responseType)}`;
    case 'examples':
      return block.config.postTitle ? `Example: "${block.config.postTitle.substring(0,30)}..."` : 'No example content set';
    case 'prompt_body':
      return block.config.text ? block.config.text.substring(0, 50) + '...' : 'Empty content';
    case 'post_title':
      return 'Dynamic Variable: {POST_TITLE}';
    case 'post_body':
      return 'Dynamic Variable: {POST_BODY}';
    case 'post_metadata':
      const fields = [];
      if (block.config.showUpvotes) fields.push('Upvotes');
      if (block.config.showComments) fields.push('Comments');
      if (block.config.showSubreddit) fields.push('Subreddit');
      return fields.length > 0 ? `Included: ${fields.join(', ')}` : 'No metadata selected';
    default:
      return '';
  }
}

function formatResponseType(type) {
  const labels = {
    'bounded_numeric': 'Bounded Number',
    'unbounded_numeric': 'Number',
    'bounded_string': 'Single Choice',
    'bounded_multiple_string': 'Multiple Choice',
    'unbounded_string': 'Free Text / Paragraph'
  };
  return labels[type] || type;
}

function openBlockSettings(blockId) {
  const blockEntry = Object.entries(blocks).find(([_, b]) => b.id === blockId);
  if (!blockEntry) return;
  
  const [order, block] = blockEntry;
  currentOpenSettings = blockId;
  
  const panel = document.getElementById('settingsPanel');
  const title = document.getElementById('settingsTitle');
  const content = document.getElementById('settingsContent');
  
  title.textContent = `${getBlockTitle(block)}`;
  content.innerHTML = getSettingsHTML(block);
  
  // document.getElementById('gridArea').style.width = '40%'; // Removed width manipulation
  panel.classList.add('open');
  
  // Setup settings event listeners
  setupSettingsListeners(blockId);
}

function closeSettings() {
  currentOpenSettings = null;
  document.getElementById('settingsPanel').classList.remove('open');
  // document.getElementById('gridArea').style.width = '';
}

function getSettingsHTML(block) {
  switch (block.type) {
    case 'bounds':
      return getBoundsSettingsHTML(block);
    case 'examples':
      return getExamplesSettingsHTML(block);
    case 'prompt_body':
      return getPromptBodySettingsHTML(block);
    case 'post_title':
      return getPostTitleSettingsHTML(block);
    case 'post_body':
      return getPostBodySettingsHTML(block);
    case 'post_metadata':
      return getPostMetadataSettingsHTML(block);
    default:
      return '<p class="text-gray-400">No settings available</p>';
  }
}

function getBoundsSettingsHTML(block) {
  const responseType = block.config.responseType;
  const config = block.config.responseConfig || {};
  
  return `
    <div class="space-y-6">
      <div>
        <label class="block text-xs font-bold text-gray-500 uppercase mb-2">Expected Response Type</label>
        <select id="responseType" class="w-full">
          <option value="">-- Select Type --</option>
          <option value="unbounded_string" ${responseType === 'unbounded_string' ? 'selected' : ''}>Paragraph / Free Text</option>
          <option value="bounded_string" ${responseType === 'bounded_string' ? 'selected' : ''}>Bounded String (Single Choice)</option>
          <option value="bounded_multiple_string" ${responseType === 'bounded_multiple_string' ? 'selected' : ''}>Bounded Multiple Strings (Multi Choice)</option>
          <option value="unbounded_numeric" ${responseType === 'unbounded_numeric' ? 'selected' : ''}>Unbounded Numeric</option>
          <option value="bounded_numeric" ${responseType === 'bounded_numeric' ? 'selected' : ''}>Bounded Numeric</option>
        </select>
      </div>
      
      <div id="typeSpecificSettings">
        ${getBoundsTypeSpecificHTML(responseType, config)}
      </div>
    </div>
  `;
}

function getBoundsTypeSpecificHTML(responseType, config) {
  if (!responseType) return '';
  
  switch (responseType) {
    case 'unbounded_string':
      return `
        <div>
          <label class="block text-xs font-bold text-gray-500 uppercase mb-2">Approximate Length (words)</label>
          <input type="number" id="approxLength" class="w-full" 
            value="${config.approximateLength || 100}" min="1" />
        </div>
      `;
    
    case 'bounded_string':
    case 'bounded_multiple_string':
      const options = config.options || [];
      return `
        <div>
          <label class="block text-xs font-bold text-gray-500 uppercase mb-2">Options</label>
          <div id="stringOptions" class="space-y-2 mb-3">
            ${options.map((opt, i) => `
              <div class="flex gap-2">
                <input type="text" class="flex-1 string-option" value="${opt}" />
                <button class="remove-option px-3 py-2 bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded transition" data-index="${i}">
                  <i class="fas fa-times"></i>
                </button>
              </div>
            `).join('')}
          </div>
          <input type="text" id="newOption" placeholder="Type and press Enter to add..." class="w-full" />
        </div>
      `;
    
    case 'unbounded_numeric':
      return `
        <div>
          <label class="block text-xs font-bold text-gray-500 uppercase mb-2">Numeric Type</label>
          <select id="numericType" class="w-full">
            <option value="integer" ${config.numericType === 'integer' ? 'selected' : ''}>Integer</option>
            <option value="real" ${config.numericType === 'real' ? 'selected' : ''}>Float / Real</option>
          </select>
        </div>
      `;
    
    case 'bounded_numeric':
      return `
        <div class="space-y-4">
          <div>
            <label class="block text-xs font-bold text-gray-500 uppercase mb-2">Numeric Type</label>
            <select id="numericType" class="w-full">
              <option value="integer" ${config.numericType === 'integer' ? 'selected' : ''}>Integer</option>
              <option value="real" ${config.numericType === 'real' ? 'selected' : ''}>Float / Real</option>
            </select>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-gray-500 uppercase mb-2">Lower Bound</label>
              <input type="number" id="lowerBound" class="w-full" 
                value="${config.lower !== undefined ? config.lower : 0}" step="${config.numericType === 'integer' ? '1' : '0.01'}" />
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-500 uppercase mb-2">Upper Bound</label>
              <input type="number" id="upperBound" class="w-full" 
                value="${config.upper !== undefined ? config.upper : 100}" step="${config.numericType === 'integer' ? '1' : '0.01'}" />
            </div>
          </div>
        </div>
      `;
    
    default:
      return '';
  }
}

function getExamplesSettingsHTML(block) {
  const config = block.config;
  
  return `
    <div class="space-y-4">
      <div>
        <label class="block text-xs font-bold text-gray-500 uppercase mb-2">Reddit Post Link (Autofill)</label>
        <div class="relative">
          <input type="url" id="redditLink" placeholder="https://reddit.com/r/..." 
            class="w-full pl-10"
            value="${config.redditLink || ''}" />
          <div class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
            <i class="fab fa-reddit-alien"></i>
          </div>
        </div>
        <p id="redditLinkStatus" class="text-xs text-blue-400 mt-2 hidden"><i class="fas fa-spinner fa-spin mr-1"></i> Fetching data...</p>
        <p id="redditLinkError" class="text-xs text-red-400 mt-2 hidden"></p>
      </div>
      
      <div class="h-px bg-white/10 my-4"></div>
      
      <div>
        <label class="block text-xs font-bold text-gray-500 uppercase mb-2">Post Title</label>
        <input type="text" id="postTitle" class="w-full" value="${config.postTitle || ''}" />
      </div>
      
      <div>
        <label class="block text-xs font-bold text-gray-500 uppercase mb-2">Post Body</label>
        <textarea id="postBody" rows="4" class="w-full">${config.postBody || ''}</textarea>
      </div>
      
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-bold text-gray-500 uppercase mb-2">Upvotes</label>
          <input type="number" id="upvotes" min="0" class="w-full" value="${config.upvotes || 0}" />
        </div>
        
        <div>
          <label class="block text-xs font-bold text-gray-500 uppercase mb-2">Comments</label>
          <input type="number" id="comments" min="0" class="w-full" value="${config.comments || 0}" />
        </div>
      </div>
      
      <div>
        <label class="block text-xs font-bold text-gray-500 uppercase mb-2 text-neon-blue">Expected Model Response</label>
        <textarea id="expectedReturn" rows="3" class="w-full border-neon-blue/30 focus:border-neon-blue/70">${config.expectedReturn || ''}</textarea>
        <div id="validationError" class="text-red-400 text-xs mt-1 hidden"></div>
      </div>
    </div>
  `;
}

function getPromptBodySettingsHTML(block) {
  return `
    <div>
      <label class="block text-xs font-bold text-gray-500 uppercase mb-2">Prompt Instructions</label>
      <textarea id="promptText" rows="15"
        class="w-full font-mono text-sm leading-relaxed"
        placeholder="Enter your system instructions or question here..."
      >${block.config.text || ''}</textarea>
    </div>
  `;
}

function getPostTitleSettingsHTML(block) {
  return `
    <div class="p-4 bg-lime-500/5 border border-lime-500/20 rounded-lg">
      <div class="flex items-start gap-3">
        <i class="fas fa-info-circle text-lime-400 mt-1"></i>
        <div>
          <p class="text-sm text-gray-300 mb-2">This block injects the title of the analyzed post.</p>
          <p class="text-xs text-gray-500 font-mono">Runtime Variable: <span class="text-lime-400">{POST_TITLE}</span></p>
        </div>
      </div>
    </div>
  `;
}

function getPostBodySettingsHTML(block) {
  return `
    <div class="p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-lg">
      <div class="flex items-start gap-3">
        <i class="fas fa-info-circle text-yellow-400 mt-1"></i>
        <div>
          <p class="text-sm text-gray-300 mb-2">This block injects the body text of the analyzed post.</p>
          <p class="text-xs text-gray-500 font-mono">Runtime Variable: <span class="text-yellow-400">{POST_BODY}</span></p>
        </div>
      </div>
    </div>
  `;
}

function getPostMetadataSettingsHTML(block) {
  const config = block.config;
  
  return `
    <div class="space-y-4">
      <p class="text-gray-400 text-sm">Select metadata fields to include:</p>
      
      <div class="space-y-3">
        <label class="flex items-center gap-3 cursor-pointer p-3 rounded hover:bg-white/5 transition">
          <input type="checkbox" id="showUpvotes" class="w-4 h-4 rounded border-gray-600 bg-black/50 text-blue-500 focus:ring-offset-black" ${config.showUpvotes ? 'checked' : ''} />
          <span class="text-gray-200 text-sm">Upvote Count</span>
        </label>
        
        <label class="flex items-center gap-3 cursor-pointer p-3 rounded hover:bg-white/5 transition">
          <input type="checkbox" id="showComments" class="w-4 h-4 rounded border-gray-600 bg-black/50 text-blue-500 focus:ring-offset-black" ${config.showComments ? 'checked' : ''} />
          <span class="text-gray-200 text-sm">Comment Count</span>
        </label>
        
        <label class="flex items-center gap-3 cursor-pointer p-3 rounded hover:bg-white/5 transition">
          <input type="checkbox" id="showSubreddit" class="w-4 h-4 rounded border-gray-600 bg-black/50 text-blue-500 focus:ring-offset-black" ${config.showSubreddit ? 'checked' : ''} />
          <span class="text-gray-200 text-sm">Source Subreddit</span>
        </label>
      </div>
    </div>
  `;
}

function setupSettingsListeners(blockId) {
  const blockEntry = Object.entries(blocks).find(([_, b]) => b.id === blockId);
  if (!blockEntry) return;
  
  const [order, block] = blockEntry;
  
  switch (block.type) {
    case 'bounds':
      setupBoundsListeners(blockId);
      break;
    case 'examples':
      setupExamplesListeners(blockId);
      break;
    case 'prompt_body':
      setupPromptBodyListeners(blockId);
      break;
    case 'post_metadata':
      setupPostMetadataListeners(blockId);
      break;
  }
}

function setupBoundsListeners(blockId) {
  const blockEntry = Object.entries(blocks).find(([_, b]) => b.id === blockId);
  if (!blockEntry) return;
  const [order, block] = blockEntry;
  
  const responseTypeSelect = document.getElementById('responseType');
  if (responseTypeSelect) {
    responseTypeSelect.addEventListener('change', (e) => {
      block.config.responseType = e.target.value;
      block.config.responseConfig = {};
      
      // Update promptData response type
      if (promptData) {
        promptData.responseType = e.target.value;
      }
      
      // Re-render type-specific settings
      document.getElementById('typeSpecificSettings').innerHTML = 
        getBoundsTypeSpecificHTML(e.target.value, {});
      
      // Re-setup listeners for new fields
      setupBoundsTypeSpecificListeners(blockId);
      
      markDirty();
      renderPromptStack();
    });
    
    setupBoundsTypeSpecificListeners(blockId);
  }
}

function setupBoundsTypeSpecificListeners(blockId) {
  const blockEntry = Object.entries(blocks).find(([_, b]) => b.id === blockId);
  if (!blockEntry) return;
  const [order, block] = blockEntry;
  
  const responseType = block.config.responseType;
  
  switch (responseType) {
    case 'unbounded_string':
      const approxLength = document.getElementById('approxLength');
      if (approxLength) {
        approxLength.addEventListener('input', (e) => {
          block.config.responseConfig.approximateLength = parseInt(e.target.value);
          markDirty();
        });
      }
      break;
      
    case 'bounded_string':
    case 'bounded_multiple_string':
      // Update existing options
      document.querySelectorAll('.string-option').forEach((input, i) => {
        input.addEventListener('input', (e) => {
          if (!block.config.responseConfig.options) {
            block.config.responseConfig.options = [];
          }
          block.config.responseConfig.options[i] = e.target.value;
          markDirty();
        });
      });
      
      // Remove option
      document.querySelectorAll('.remove-option').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const index = parseInt(e.target.dataset.index);
          block.config.responseConfig.options.splice(index, 1);
          document.getElementById('typeSpecificSettings').innerHTML = 
            getBoundsTypeSpecificHTML(responseType, block.config.responseConfig);
          setupBoundsTypeSpecificListeners(blockId);
          markDirty();
        });
      });
      
      // Add new option
      const newOption = document.getElementById('newOption');
      if (newOption) {
        newOption.addEventListener('keypress', (e) => {
          if (e.key === 'Enter' && e.target.value.trim()) {
            if (!block.config.responseConfig.options) {
              block.config.responseConfig.options = [];
            }
            block.config.responseConfig.options.push(e.target.value.trim());
            e.target.value = '';
            document.getElementById('typeSpecificSettings').innerHTML = 
              getBoundsTypeSpecificHTML(responseType, block.config.responseConfig);
            setupBoundsTypeSpecificListeners(blockId);
            markDirty();
          }
        });
      }
      break;
      
    case 'unbounded_numeric':
    case 'bounded_numeric':
      const numericType = document.getElementById('numericType');
      if (numericType) {
        numericType.addEventListener('change', (e) => {
          block.config.responseConfig.numericType = e.target.value;
          
          // Update step for bounds inputs if they exist
          const lowerBound = document.getElementById('lowerBound');
          const upperBound = document.getElementById('upperBound');
          if (lowerBound) lowerBound.step = e.target.value === 'integer' ? '1' : '0.01';
          if (upperBound) upperBound.step = e.target.value === 'integer' ? '1' : '0.01';
          
          markDirty();
        });
      }
      
      if (responseType === 'bounded_numeric') {
        const lowerBound = document.getElementById('lowerBound');
        const upperBound = document.getElementById('upperBound');
        
        if (lowerBound) {
          lowerBound.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            if (block.config.responseConfig.numericType === 'integer') {
              block.config.responseConfig.lower = Math.floor(val);
            } else {
              block.config.responseConfig.lower = val;
            }
            markDirty();
          });
        }
        
        if (upperBound) {
          upperBound.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            if (block.config.responseConfig.numericType === 'integer') {
              block.config.responseConfig.upper = Math.floor(val);
            } else {
              block.config.responseConfig.upper = val;
            }
            markDirty();
          });
        }
      }
      break;
  }
}

function setupExamplesListeners(blockId) {
  const blockEntry = Object.entries(blocks).find(([_, b]) => b.id === blockId);
  if (!blockEntry) return;
  const [order, block] = blockEntry;
  
  const fields = ['redditLink', 'postTitle', 'postBody', 'upvotes', 'comments', 'expectedReturn'];
  
  // Debounce timer for Reddit link autofill
  let redditLinkDebounceTimer = null;
  
  fields.forEach(field => {
    const input = document.getElementById(field);
    if (input) {
      input.addEventListener('input', (e) => {
        let value = e.target.value;
        
        if (field === 'upvotes' || field === 'comments') {
          value = parseInt(value) || 0;
        }
        
        block.config[field] = value;
        
        // Validate expectedReturn in real-time
        if (field === 'expectedReturn') {
          validateExpectedReturn(blockId, value);
        }
        
        // Handle Reddit link autofill with heavy debouncing
        if (field === 'redditLink') {
          clearTimeout(redditLinkDebounceTimer);
          
          // Clear status/error messages
          const statusEl = document.getElementById('redditLinkStatus');
          const errorEl = document.getElementById('redditLinkError');
          if (statusEl) statusEl.classList.add('hidden');
          if (errorEl) errorEl.classList.add('hidden');
          
          // Only trigger autofill if value looks like a Reddit URL
          if (value && isValidRedditUrl(value)) {
            redditLinkDebounceTimer = setTimeout(() => {
              fetchRedditPostData(blockId, value);
            }, 2000); // 2 second debounce
          }
        }
        
        markDirty();
        renderPromptStack();
      });
      
      // Also trigger on paste for immediate validation
      if (field === 'redditLink') {
        input.addEventListener('paste', (e) => {
          // Wait for paste to complete
          setTimeout(() => {
            const value = e.target.value;
            if (value && isValidRedditUrl(value)) {
              clearTimeout(redditLinkDebounceTimer);
              redditLinkDebounceTimer = setTimeout(() => {
                fetchRedditPostData(blockId, value);
              }, 1500); // Slightly faster on paste
            }
          }, 50);
        });
      }
    }
  });
}

function isValidRedditUrl(url) {
  /**
   * Check if URL matches valid Reddit post formats:
   * - https://www.reddit.com/r/subreddit/comments/abc123/post_title/
   * - https://old.reddit.com/r/subreddit/comments/abc123/post_title/
   * - https://reddit.com/r/subreddit/comments/abc123/
   * - https://redd.it/abc123
   */
  const patterns = [
    /reddit\.com\/r\/\w+\/comments\/[A-Za-z0-9]+/,
    /redd\.it\/[A-Za-z0-9]+/
  ];
  
  return patterns.some(pattern => pattern.test(url));
}

async function fetchRedditPostData(blockId, redditUrl) {
  /**
   * Call the Cloud Function to fetch Reddit post data and autofill fields
   */
  const statusEl = document.getElementById('redditLinkStatus');
  const errorEl = document.getElementById('redditLinkError');
  
  // Show loading state
  if (statusEl) {
    statusEl.classList.remove('hidden');
    statusEl.classList.remove('text-green-400');
    statusEl.classList.add('text-blue-400');
    statusEl.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Fetching post data...';
  }
  if (errorEl) {
    errorEl.classList.add('hidden');
  }
  
  try {
    // Ensure user is authenticated
    if (!currentUser) {
      throw new Error('You must be logged in to fetch Reddit post data.');
    }
    
    // Always call the HTTP endpoint with explicit Authorization header
    const idToken = await currentUser.getIdToken();
    const projectId = window.firebase?.app?.options?.projectId;
    const region = 'us-central1';
    const url = `https://${region}-${projectId}.cloudfunctions.net/fetch_reddit_post_http`;
    console.log('Calling fetch_reddit_post_http with URL:', redditUrl);
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({ reddit_url: redditUrl })
    });
    if (!resp.ok) {
      let errMsg = `HTTP ${resp.status}`;
      try {
        const errJson = await resp.json();
        if (errJson && errJson.error) errMsg = errJson.error;
      } catch {}
      throw new Error(errMsg);
    }
    const postData = await resp.json();
    
    // Find the block and update its config
    const blockEntry = Object.entries(blocks).find(([_, b]) => b.id === blockId);
    if (!blockEntry) return;
    const [order, block] = blockEntry;
    
    // Autofill the fields
    block.config.postTitle = postData.post_title || '';
    block.config.postBody = postData.post_body || '';
    block.config.upvotes = postData.upvotes || 0;
    block.config.comments = postData.comments_count || 0;
    
    // Update the UI inputs
    const postTitleInput = document.getElementById('postTitle');
    const postBodyInput = document.getElementById('postBody');
    const upvotesInput = document.getElementById('upvotes');
    const commentsInput = document.getElementById('comments');
    
    if (postTitleInput) postTitleInput.value = block.config.postTitle;
    if (postBodyInput) postBodyInput.value = block.config.postBody;
    if (upvotesInput) upvotesInput.value = block.config.upvotes;
    if (commentsInput) commentsInput.value = block.config.comments;
    
    // Show success message
    if (statusEl) {
      statusEl.innerHTML = '<i class="fas fa-check mr-1"></i> Data loaded!';
      statusEl.classList.remove('text-blue-400');
      statusEl.classList.add('text-green-400');
      
      // Hide success message after 3 seconds
      setTimeout(() => {
        statusEl.classList.add('hidden');
      }, 3000);
    }
    
    markDirty();
    renderPromptStack();
    
  } catch (error) {
    console.error('Error fetching Reddit post:', error);
    
    // Show error message
    if (errorEl) {
      errorEl.textContent = error.message || 'Failed to fetch post data.';
      errorEl.classList.remove('hidden');
    }
    if (statusEl) {
      statusEl.classList.add('hidden');
    }
  }
}

function validateExpectedReturn(blockId, value) {
  // Find bounds block to check response type
  const boundsBlock = Object.values(blocks).find(b => b.type === 'bounds');
  if (!boundsBlock || !boundsBlock.config.responseType) return true;
  
  const responseType = boundsBlock.config.responseType;
  const config = boundsBlock.config.responseConfig || {};
  const errorDiv = document.getElementById('validationError');
  
  let isValid = true;
  let errorMsg = '';
  
  switch (responseType) {
    case 'bounded_numeric':
    case 'unbounded_numeric':
      const num = parseFloat(value);
      if (isNaN(num)) {
        isValid = false;
        errorMsg = 'Expected return must be a number';
      } else if (responseType === 'bounded_numeric') {
        if (config.lower !== undefined && num < config.lower) {
          isValid = false;
          errorMsg = `Number must be >= ${config.lower}`;
        } else if (config.upper !== undefined && num > config.upper) {
          isValid = false;
          errorMsg = `Number must be <= ${config.upper}`;
        }
        
        if (config.numericType === 'integer' && !Number.isInteger(num)) {
          isValid = false;
          errorMsg = 'Number must be an integer';
        }
      }
      break;
      
    case 'bounded_string':
      if (config.options && !config.options.includes(value)) {
        isValid = false;
        errorMsg = `Must be one of: ${config.options.join(', ')}`;
      }
      break;
  }
  
  if (errorDiv) {
    if (isValid) {
      errorDiv.classList.add('hidden');
      errorDiv.textContent = '';
    } else {
      errorDiv.classList.remove('hidden');
      errorDiv.textContent = errorMsg;
    }
  }
  
  return isValid;
}

function setupPromptBodyListeners(blockId) {
  const blockEntry = Object.entries(blocks).find(([_, b]) => b.id === blockId);
  if (!blockEntry) return;
  const [order, block] = blockEntry;
  
  const textarea = document.getElementById('promptText');
  if (textarea) {
    textarea.addEventListener('input', (e) => {
      block.config.text = e.target.value;
      markDirty();
      // No need to re-render whole stack on text input, loss of focus
    });
  }
}

function setupPostMetadataListeners(blockId) {
  const blockEntry = Object.entries(blocks).find(([_, b]) => b.id === blockId);
  if (!blockEntry) return;
  const [order, block] = blockEntry;
  
  const checkboxes = ['showUpvotes', 'showComments', 'showSubreddit'];
  
  checkboxes.forEach(field => {
    const checkbox = document.getElementById(field);
    if (checkbox) {
      checkbox.addEventListener('change', (e) => {
        block.config[field] = e.target.checked;
        markDirty();
        renderPromptStack();
      });
    }
  });
}

function markDirty() {
  isDirty = true;
  const saveBtn = document.getElementById('saveBtn');
  saveBtn.classList.add('enabled');
  saveBtn.disabled = false;
}

function validatePrompt() {
  const errors = [];
  
  // Check for bounds block
  const boundsBlock = Object.values(blocks).find(b => b.type === 'bounds');
  if (!boundsBlock) {
    errors.push('Bounds block is required');
  } else if (!boundsBlock.config.responseType) {
    errors.push('Bounds block must be configured');
  }
  
  // Check for prompt body blocks
  const promptBodyBlocks = Object.values(blocks).filter(b => b.type === 'prompt_body');
  
  if (promptBodyBlocks.length === 0) {
    errors.push('At least one Prompt Body block is required');
  }
  
  // Check that no prompt body block is empty
  let hasEmptyPromptBody = false;
  promptBodyBlocks.forEach(block => {
    if (!block.config.text || !block.config.text.trim()) {
      hasEmptyPromptBody = true;
    }
  });
  
  if (hasEmptyPromptBody) {
    errors.push('All Prompt Body blocks must have text');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

function compilePrompt() {
  let compiled = '';
  
  // Get bounds block for header/footer
  const boundsBlock = Object.values(blocks).find(b => b.type === 'bounds');
  if (!boundsBlock || !boundsBlock.config.responseType) {
    return 'Error: Bounds block not configured';
  }
  
  const responseType = boundsBlock.config.responseType;
  const config = boundsBlock.config.responseConfig || {};
  const templates = promptTemplates?.types?.[responseType] || {};
  
  // Add header with proper config path
  let header = templates.header || '';
  const responseConfig = boundsBlock.config.responseConfig || {};
  header = header.replace(/{lower}/g, responseConfig.lower !== undefined ? responseConfig.lower : '');
  header = header.replace(/{upper}/g, responseConfig.upper !== undefined ? responseConfig.upper : '');
  header = header.replace(/{options}/g, (responseConfig.options || []).join(', '));
  header = header.replace(/{approximate-response-length}/g, responseConfig.approximateLength || '');
  
  compiled += header + '\n\n';
  
  // Add blocks in order (excluding bounds)
  const sortedBlocks = Object.entries(blocks)
    .filter(([_, b]) => b.type !== 'bounds')
    .sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
  
  sortedBlocks.forEach(([order, block]) => {
    const blockText = compileBlock(block);
    if (blockText) {
      compiled += blockText + '\n\n';
    }
  });
  
  // Add footer with proper config path
  let footer = templates.footer || '';
  footer = footer.replace(/{lower}/g, responseConfig.lower !== undefined ? responseConfig.lower : '');
  footer = footer.replace(/{upper}/g, responseConfig.upper !== undefined ? responseConfig.upper : '');
  footer = footer.replace(/{options}/g, (responseConfig.options || []).join(', '));
  
  compiled += footer;
  
  return compiled.trim();
}

function compileBlock(block) {
  switch (block.type) {
    case 'examples':
      return compileExampleBlock(block);
    case 'prompt_body':
      return block.config.text || '';
    case 'post_title':
      return 'Post Title: {POST_TITLE}';
    case 'post_body':
      return 'Post Body: {POST_BODY}';
    case 'post_metadata':
      return compileMetadataBlock(block);
    default:
      return '';
  }
}

function compileExampleBlock(block) {
  const intros = promptTemplates?.exampleIntros || {};
  let text = '';
  
  if (intros.Intro) {
    text += intros.Intro + '\n';
  }
  
  if (block.config.postTitle && intros.postTitle) {
    text += intros.postTitle.replace(/{title}/g, block.config.postTitle) + '\n';
  }
  
  if (block.config.postBody && intros.postBody) {
    text += intros.postBody.replace(/{post}/g, block.config.postBody) + '\n';
  }
  
  if (block.config.upvotes !== undefined && intros.upvoteCount) {
    text += intros.upvoteCount.replace(/{upvotes}/g, block.config.upvotes) + '\n';
  }
  
  if (block.config.comments !== undefined && intros.commentCount) {
    text += intros.commentCount.replace(/{comments}/g, block.config.comments) + '\n';
  }
  
  if (block.config.expectedReturn && intros.expectedReturn) {
    text += intros.expectedReturn.replace(/{return}/g, block.config.expectedReturn) + '\n';
  }
  
  return text.trim();
}

function compileMetadataBlock(block) {
  const parts = [];
  
  if (block.config.showUpvotes) {
    parts.push('Upvotes: {POST_UPVOTES}');
  }
  
  if (block.config.showComments) {
    parts.push('Comments: {POST_COMMENTS}');
  }
  
  if (block.config.showSubreddit) {
    parts.push('Subreddit: {POST_SUBREDDIT}');
  }
  
  return parts.join('\n');
}

function showCompiledPrompt() {
  const validation = validatePrompt();
  
  if (!validation.isValid) {
    alert('Cannot compile prompt:\n' + validation.errors.join('\n'));
    return;
  }
  
  const compiled = compilePrompt();
  document.getElementById('compiledPromptDisplay').textContent = compiled;
  document.getElementById('viewPromptModal').classList.add('show');
}

async function savePrompt() {
  const validation = validatePrompt();
  
  if (!validation.isValid) {
    showTooltip('Cannot save: ' + validation.errors.join(', '));
    return;
  }
  
  try {
    const compiled = compilePrompt();
    
    // Update promptData
    promptData.name = document.getElementById('promptName').value || 'Untitled Prompt';
    promptData.blocks = blocks;
    promptData.compiledPrompt = compiled;
    promptData.updatedAt = serverTimestamp();
    
    if (!promptData.createdAt) {
      promptData.createdAt = serverTimestamp();
    }
    
    // Save to Firestore
    const docRef = doc(db, `users/${currentUser.uid}/prompts`, promptId);
    await setDoc(docRef, promptData, { merge: true });
    
    isDirty = false;
    const saveBtn = document.getElementById('saveBtn');
    saveBtn.classList.remove('enabled');
    saveBtn.disabled = true;
    
    showTooltip('Prompt saved successfully!', 'success');
  } catch (error) {
    console.error('Error saving prompt:', error);
    showTooltip('Error saving prompt: ' + error.message, 'error');
  }
}

function showTooltip(message, type = 'info') {
  // Simple tooltip implementation
  const saveBtn = document.getElementById('saveBtn');
  saveBtn.title = message;
  
  // Could be enhanced with a proper tooltip library
  alert(message);
}

// Prevent navigation if unsaved changes
window.addEventListener('beforeunload', (e) => {
  if (isDirty) {
    e.preventDefault();
    e.returnValue = '';
  }
});
