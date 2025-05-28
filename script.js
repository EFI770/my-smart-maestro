// --- מבני נתונים גלובליים ---
const DATA_KEYS = {
    SHOPPING_LIST: 'maestroShoppingList',
    PURCHASE_HISTORY: 'maestroPurchaseHistory',
    ITEM_PATTERNS: 'maestroItemPatterns',
    BUDGET_DATA: 'maestroBudgetData',
    USER_SETTINGS: 'maestroUserSettings',
    SAVINGS_DATA: 'maestroSavingsData',
};

let shoppingList = [];
let purchaseHistory = [];
let itemPatterns = {};
let budgetData = {
    monthlyBudget: 0,
    monthlySpent: 0,
    lastBudgetResetMonth: new Date().getMonth()
};
let userSettings = {
    userName: 'משתמש יקר'
};
let savingsData = {
    totalSavings: 0,
    totalWastedCost: 0
};

// --- משתנים גלובליים לטיפול ב-3D Cube ---
const maestroCube = document.getElementById('maestro-cube');
let currentRotationY = 0; // זווית הסיבוב הנוכחית בדרגות
let startX = 0; // נקודת התחלה של גרירה (עכבר/מגע)
let isDragging = false; // האם המשתמש גורר כרגע?
let targetFaceIndex = 0; // אינדקס הדופן שכרגע מוצגת או יעד ההצמדה (0, 1, 2, 3)

// --- פונקציות עזר ל-localStorage ---
function loadData(key, defaultValue) {
    const data = localStorage.getItem(key);
    try {
        return data ? JSON.parse(data) : defaultValue;
    } catch (e) {
        console.error(`Error parsing data from localStorage for key ${key}:`, e);
        return defaultValue;
    }
}

function saveData(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.error(`Error saving data to localStorage for key ${key}:`, e);
    }
}

// --- פונקציות אתחול נתונים ---
function initializeData() {
    shoppingList = loadData(DATA_KEYS.SHOPPING_LIST, []);
    purchaseHistory = loadData(DATA_KEYS.PURCHASE_HISTORY, []);
    itemPatterns = loadData(DATA_KEYS.ITEM_PATTERNS, {});
    budgetData = loadData(DATA_KEYS.BUDGET_DATA, {
        monthlyBudget: 0,
        monthlySpent: 0,
        lastBudgetResetMonth: new Date().getMonth()
    });
    userSettings = loadData(DATA_KEYS.USER_SETTINGS, {
        userName: 'משתמש יקר'
    });
    savingsData = loadData(DATA_KEYS.SAVINGS_DATA, {
        totalSavings: 0,
        totalWastedCost: 0
    });

    const currentMonth = new Date().getMonth();
    if (budgetData.lastBudgetResetMonth !== currentMonth) {
        budgetData.monthlySpent = 0;
        budgetData.lastBudgetResetMonth = currentMonth;
        saveData(DATA_KEYS.BUDGET_DATA, budgetData);
    }

    // רנדור התוכן של הדופן הראשונה בלבד בעת האתחול
    renderFaceContent(targetFaceIndex);
    updateUserName(); // לוודא ששם המשתמש מתעדכן מיידית

    // הגדרת שם משתמש בשדה ההגדרות (דופן 4)
    const userNameSettingInput = document.getElementById('user-name-setting');
    if (userNameSettingInput) {
        userNameSettingInput.value = userSettings.userName;
    }
}

// --- פונקציות רנדור UI (חלק מהן נשארות כפי שהיו, חלק נקראות לפי דופן) ---

function renderShoppingList() {
    const shoppingListEl = document.getElementById('shopping-list');
    if (!shoppingListEl) return;

    shoppingListEl.innerHTML = '';

    if (shoppingList.length === 0) {
        shoppingListEl.innerHTML = '<p class="text-gray-500">אין פריטים ברשימה עדיין.</p>';
        document.getElementById('total-cost').textContent = '₪ 0.00';
        return;
    }

    let totalCost = 0;
    shoppingList.forEach(item => {
        const itemEl = document.createElement('div');
        const urgencyClass = getItemUrgencyClass(item.name);
        const budgetWarningClass = checkItemBudgetImpact(item);

        const price = item.pricePerUnit || itemPatterns[item.name]?.lastKnownPrice || 0;
        const itemTotal = (item.quantity || 1) * price;
        totalCost += itemTotal;

        itemEl.className = `flex items-center justify-between p-3 bg-gray-50 rounded-md shadow-sm border border-gray-200 ${urgencyClass} ${budgetWarningClass}`;
        
        itemEl.innerHTML = `
            <div class="flex-grow text-right ml-4">
                <span class="font-semibold text-lg">${item.name}</span>
                <span class="text-gray-600 text-sm mr-2">${item.quantity ? `x${item.quantity}` : ''}</span>
                <span class="text-gray-500 text-xs">${item.category ? `(${item.category})` : ''}</span>
                ${price > 0 ? `<span class="text-green-600 text-sm block">₪${itemTotal.toFixed(2)} (${price.toFixed(2)}/יח')</span>` : ''}
            </div>
            <div class="flex gap-2">
                <button data-id="${item.id}" class="remove-item-btn bg-red-100 text-red-700 px-3 py-1 rounded-md text-sm hover:bg-red-200 transition">הסר</button>
            </div>
        `;
        shoppingListEl.appendChild(itemEl);
    });

    document.getElementById('total-cost').textContent = `₪ ${totalCost.toFixed(2)}`;

    document.querySelectorAll('.remove-item-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const itemId = e.target.dataset.id;
            removeItemFromList(itemId);
        });
    });
}

function updateBudgetSummary() {
    const monthlyBudgetAmountEl = document.getElementById('monthly-budget-amount');
    const monthlySpentAmountEl = document.getElementById('monthly-spent-amount');
    const monthlyRemainingAmountEl = document.getElementById('monthly-remaining-amount');
    const budgetProgressBar = document.getElementById('budget-progress-bar');
    const setMonthlyBudgetInput = document.getElementById('set-monthly-budget');

    if (!monthlyBudgetAmountEl) return;

    monthlyBudgetAmountEl.textContent = `₪ ${budgetData.monthlyBudget.toFixed(2)}`;
    monthlySpentAmountEl.textContent = `₪ ${budgetData.monthlySpent.toFixed(2)}`;
    monthlyRemainingAmountEl.textContent = `₪ ${(budgetData.monthlyBudget - budgetData.monthlySpent).toFixed(2)}`;
    if (setMonthlyBudgetInput) { // וודא שהאלמנט קיים לפני הגישה
        setMonthlyBudgetInput.value = budgetData.monthlyBudget > 0 ? budgetData.monthlyBudget : '';
    }

    if (budgetProgressBar) { // וודא שהאלמנט קיים לפני הגישה
        const progress = budgetData.monthlyBudget > 0 ? (budgetData.monthlySpent / budgetData.monthlyBudget) * 100 : 0;
        budgetProgressBar.style.width = `${Math.min(100, progress)}%`;

        if (progress > 90) {
            budgetProgressBar.className = 'bg-red-600 h-2.5 rounded-full';
        } else if (progress > 60) {
            budgetProgressBar.className = 'bg-yellow-500 h-2.5 rounded-full';
        } else {
            budgetProgressBar.className = 'bg-green-600 h-2.5 rounded-full';
        }
    }
}

function updateUserName() {
    const userNameSpan = document.getElementById('user-name');
    if (userNameSpan) {
        userNameSpan.textContent = userSettings.userName;
    }
    const userNameSettingInput = document.getElementById('user-name-setting');
    if (userNameSettingInput) {
        userNameSettingInput.value = userSettings.userName;
    }
}

function updateSavingsSummary() {
    const totalSavingsAmountEl = document.getElementById('total-savings-amount');
    const totalWastedCostSummaryEl = document.getElementById('total-wasted-cost-summary');
    const savingsSummaryTextEl = document.getElementById('savings-summary')?.querySelector('p:last-of-type');

    if (!totalSavingsAmountEl) return;

    totalSavingsAmountEl.textContent = `₪ ${savingsData.totalSavings.toFixed(2)}`;
    totalWastedCostSummaryEl.textContent = `₪ ${savingsData.totalWastedCost.toFixed(2)}`;
    
    const wastedCost = savingsData.totalWastedCost;
    let opportunityText = 'התחל לדווח על בזבוזים בסיום קנייה כדי לראות תובנות!';

    if (wastedCost > 0) {
        if (wastedCost >= 500) {
            opportunityText = `עם ₪${wastedCost.toFixed(2)} שהיו יכולים להיות בכיסך, היית יכול לצאת לחופשה קצרה!`;
        } else if (wastedCost >= 200) {
            opportunityText = `עם ₪${wastedCost.toFixed(2)} שהיו יכולים להיות בכיסך, היית יכול לקנות ארוחת ערב מפנקת למשפחה!`;
        } else if (wastedCost >= 50) {
            opportunityText = `עם ₪${wastedCost.toFixed(2)} שהיו יכולים להיות בכיסך, היית יכול לקנות 2 כוסות קפה הפוך ביום!`;
        } else {
            opportunityText = `עם ₪${wastedCost.toFixed(2)} שהיו יכולים להיות בכיסך, היית יכול לקנות משהו קטן שרצית!`;
        }
    }
    if (savingsSummaryTextEl) {
        savingsSummaryTextEl.textContent = opportunityText;
    }
}

function renderMaestroInsights() {
    const insightTextEl = document.getElementById('insight-text');
    if (!insightTextEl) return;

    insightTextEl.innerHTML = '';

    const patternsCount = Object.keys(itemPatterns).length;
    if (patternsCount < 5) {
        insightTextEl.innerHTML = `<p class="text-gray-500">המערכת לומדת את הרגלי הקנייה שלך. ברגע שתאסוף מספיק נתונים (${patternsCount}/5 פריטים נרכשו מספר פעמים), תציג כאן תובנות חכמות!</p>`;
        return;
    }

    const insights = [];

    const highWasteItems = Object.entries(itemPatterns).filter(([name, pattern]) => {
        if (!pattern.wastedQuantities || pattern.wastedQuantities.length === 0) return false;
        const totalWasted = pattern.wastedQuantities.reduce((sum, w) => sum + w.quantity, 0);
        const totalBought = pattern.quantitiesBought.reduce((sum, q) => sum + q, 0);
        return totalBought > 0 && (totalWasted / totalBought) > 0.15;
    }).map(([name, pattern]) => name);

    if (highWasteItems.length > 0) {
        insights.push(`שים לב ל${highWasteItems.join(', ')} – נראה שאתה נוטה לבזבז מהם יותר. נסה לקנות פחות או לאחסן טוב יותר!`);
    }

    const volatilePriceItems = Object.entries(itemPatterns).filter(([name, pattern]) => {
        if (!pattern.priceHistory || pattern.priceHistory.length < 3) return false;
        const prices = pattern.priceHistory.map(p => p.price);
        const maxPrice = Math.max(...prices);
        const minPrice = Math.min(...prices);
        return (maxPrice - minPrice) / minPrice > 0.20;
    }).map(([name, pattern]) => name);

    if (volatilePriceItems.length > 0) {
        insights.push(`מחירי ${volatilePriceItems.join(', ')} נוטים להשתנות. אולי שווה לבדוק מבצעים לפני הקנייה!`);
    }
    
    const correlationMap = {};
    for (const itemName in itemPatterns) {
        const pattern = itemPatterns[itemName];
        for (const correlatedItem in pattern.correlationCounts) {
            const pair = [itemName, correlatedItem].sort().join('-');
            correlationMap[pair] = (correlationMap[pair] || 0) + pattern.correlationCounts[correlatedItem];
        }
    }
    const sortedCorrelations = Object.entries(correlationMap).sort(([,countA], [,countB]) => countB - countA);

    if (sortedCorrelations.length > 0 && sortedCorrelations[0][1] >= 3) {
        const [item1, item2] = sortedCorrelations[0][0].split('-');
        insights.push(`שמת לב שאתה קונה לעיתים קרובות ${item1} וגם ${item2}? אולי כדאי לתכנן את הקנייה שלהם ביחד!`);
    }

    if (insights.length === 0) {
        insightTextEl.innerHTML = '<p class="text-gray-500">המאסטרו ממשיך ללמוד את הרגלי הקנייה שלך. בקרוב יופיעו כאן תובנות נוספות!</p>';
        return;
    }

    insightTextEl.innerHTML = insights.map(insight => `<p class="mb-2 text-base font-medium">✨ ${insight}</p>`).join('');
}


function renderDashboard() {
    updateBudgetSummary();
    renderUrgentItems();
    renderSmartSuggestions();
    checkOverallBudgetAlert();
    updateSavingsSummary();
    renderMaestroInsights();
}

function renderFullPurchaseHistory() {
    const historyListEl = document.getElementById('purchase-history-list');
    if (!historyListEl) return;

    historyListEl.innerHTML = '';
    if (purchaseHistory.length === 0) {
        historyListEl.innerHTML = '<p class="text-gray-500">אין היסטוריית קניות לשלוף.</p>';
        return;
    }

    purchaseHistory.sort((a,b) => new Date(b.purchaseDate) - new Date(a.purchaseDate));

    purchaseHistory.forEach(purchase => {
        const purchaseEl = document.createElement('div');
        purchaseEl.className = 'bg-gray-50 p-3 rounded-md shadow-sm border border-gray-200 mb-2';
        const purchaseDate = new Date(purchase.purchaseDate).toLocaleDateString('he-IL', {
            year: 'numeric', month: 'numeric', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
        purchaseEl.innerHTML = `
            <p class="font-semibold text-lg text-gray-700">תאריך: ${purchaseDate} | סה"כ: ₪${purchase.totalCost.toFixed(2)}</p>
            ${purchase.wastedCost > 0 ? `<p class="text-red-600 text-sm">מתוכם בזבוז: ₪${purchase.wastedCost.toFixed(2)}</p>` : ''}
            <ul class="list-disc list-inside text-sm text-gray-600 mt-1 mr-4">
                ${purchase.items.map(item => `<li>${item.name} x${item.quantity} (${item.category}) - ₪${(item.actualPrice * item.quantity).toFixed(2)} ${item.wastedQuantity > 0 ? `<span class="text-red-500">(בזבזת ${item.wastedQuantity} יח')</span>` : ''}</li>`).join('')}
            </ul>
        `;
        historyListEl.appendChild(purchaseEl);
    });
}

function renderWasteReport() {
    const wasteReportListEl = document.getElementById('waste-report-list');
    if (!wasteReportListEl) return;

    wasteReportListEl.innerHTML = '';

    let totalWastedCost = 0;
    const wasteSummary = {};
    const potentialSavingsSummary = {};

    for (const itemName in itemPatterns) {
        const pattern = itemPatterns[itemName];
        if (pattern.wastedQuantities && pattern.wastedQuantities.length > 0) {
            const itemTotalWastedQuantity = pattern.wastedQuantities.reduce((sum, w) => sum + w.quantity, 0);
            const itemTotalWastedCost = pattern.wastedQuantities.reduce((sum, w) => sum + w.cost, 0);

            if (itemTotalWastedQuantity > 0) {
                wasteSummary[itemName] = {
                    totalQuantity: itemTotalWastedQuantity,
                    totalCost: itemTotalWastedCost
                };
                totalWastedCost += itemTotalWastedCost;
            }
        }

        if (pattern.priceHistory && pattern.priceHistory.length > 1) {
            const currentAvgPrice = pattern.priceHistory.reduce((sum, p) => sum + p.price, 0) / pattern.priceHistory.length;
            const lastPrice = pattern.lastKnownPrice;

            if (lastPrice > currentAvgPrice * 1.05) {
                const potentialSavingsPerUnit = (lastPrice - currentAvgPrice);
                potentialSavingsSummary[itemName] = (potentialSavingsSummary[itemName] || 0) + potentialSavingsPerUnit * (pattern.typicalQuantity || 1);
            }
        }
    }

    if (Object.keys(wasteSummary).length === 0 && Object.keys(potentialSavingsSummary).length === 0) {
        wasteReportListEl.innerHTML = '<p class="text-gray-500">אין נתונים לדוח הזדמנויות חיסכון עדיין. ודא שאתה מזין מחירים וכמויות בזבוז בסיום קנייה.</p>';
        return;
    }

    if (totalWastedCost > 0) {
        wasteReportListEl.innerHTML += `<p class="text-xl font-bold text-red-700 mb-4">סה"כ בזבוזים שניתן היה למנוע: ₪${totalWastedCost.toFixed(2)}</p>`;
        wasteReportListEl.innerHTML += `<p class="text-lg text-gray-600 mb-4">זוהי ההזדמנות הגדולה ביותר שלך לחסוך בעתיד על ידי צמצום בזבוזים!</p>`;
    }

    if (Object.keys(wasteSummary).length > 0) {
        wasteReportListEl.innerHTML += `<h3 class="text-lg font-semibold text-gray-700 mt-4 mb-2">פריטים עם בזבוז שנצפה:</h3>`;
        for (const itemName in wasteSummary) {
            const wasteData = wasteSummary[itemName];
            const itemEl = document.createElement('div');
            itemEl.className = 'bg-red-50 p-3 rounded-md shadow-sm border border-red-200 mb-2 flex justify-between items-center';
            itemEl.innerHTML = `
                <span class="font-semibold text-lg">${itemName}</span>
                <span class="text-red-700 text-base">בזבזת: ${wasteData.totalQuantity} יח' (₪${wasteData.totalCost.toFixed(2)})</span>
            `;
            wasteReportListEl.appendChild(itemEl);
        }
    }

    if (Object.keys(potentialSavingsSummary).length > 0) {
        wasteReportListEl.innerHTML += `<h3 class="text-lg font-semibold text-gray-700 mt-4 mb-2">פוטנציאל חיסכון ממחירים:</h3>`;
        for (const itemName in potentialSavingsSummary) {
            const potential = potentialSavingsSummary[itemName];
            const itemEl = document.createElement('div');
            itemEl.className = 'bg-green-50 p-3 rounded-md shadow-sm border border-green-200 mb-2 flex justify-between items-center';
            itemEl.innerHTML = `
                <span class="font-semibold text-lg">${itemName}</span>
                <span class="text-green-700 text-base">פוטנציאל חיסכון: ₪${potential.toFixed(2)} (על כמות טיפוסית)</span>
            `;
            wasteReportListEl.appendChild(itemEl);
        }
    }
}

// פונקציה לרינדור תוכן של דופן מסוימת
function renderFaceContent(faceIndex) {
    switch (faceIndex) {
        case 0: // Face 1: Dashboard and Shopping List
            renderDashboard();
            renderShoppingList();
            break;
        case 1: // Face 2: Purchase History
            renderFullPurchaseHistory();
            break;
        case 2: // Face 3: Waste Report & Insights
            renderWasteReport();
            renderMaestroInsights();
            break;
        case 3: // Face 4: Settings
            updateUserName();
            break;
    }
}

// --- פונקציות לוגיקה עסקית (ללא שינוי מהותי) ---

function addItemToList(name, quantity = 1, category = 'Other', pricePerUnit = 0) {
    const newItem = {
        id: crypto.randomUUID(),
        name: name.trim(),
        quantity: parseInt(quantity) || 1,
        category: category || 'Other',
        pricePerUnit: parseFloat(pricePerUnit) || 0,
        addedDate: new Date().toISOString()
    };
    shoppingList.push(newItem);
    saveData(DATA_KEYS.SHOPPING_LIST, shoppingList);
    renderShoppingList();
    checkItemAdditionPrompts(newItem);
    return newItem;
}

function removeItemFromList(itemId) {
    shoppingList = shoppingList.filter(item => item.id === itemId);
    saveData(DATA_KEYS.SHOPPING_LIST, shoppingList);
    renderShoppingList();
    renderSmartSuggestions();
    checkOverallBudgetAlert();
}

function initiatePurchaseConfirmation() {
    if (shoppingList.length === 0) {
        alert('רשימת הקניות ריקה!');
        return;
    }

    const modal = document.getElementById('purchase-confirmation-modal');
    const modalItemList = document.getElementById('modal-item-list');
    modalItemList.innerHTML = '';

    shoppingList.forEach(item => {
        const itemPattern = itemPatterns[item.name] || {};
        const lastKnownPrice = item.pricePerUnit || itemPattern.lastKnownPrice || 0; 
        
        const itemEl = document.createElement('div');
        itemEl.className = 'flex flex-col md:flex-row items-center justify-between p-3 bg-gray-50 rounded-md border border-gray-200';
        itemEl.innerHTML = `
            <div class="flex-grow text-right mb-2 md:mb-0">
                <span class="font-semibold text-lg">${item.name} <span class="text-gray-600">x${item.quantity}</span></span>
                <span class="text-gray-500 text-sm block">${item.category}</span>
            </div>
            <div class="flex flex-col md:flex-row gap-2 w-full md:w-auto">
                <div class="flex items-center">
                    <label class="text-sm text-gray-700 ml-1 whitespace-nowrap">מחיר ליח' בפועל:</label>
                    <input type="number" data-id="${item.id}" data-field="actualPrice" 
                           value="${lastKnownPrice.toFixed(2)}" step="0.01" 
                           class="modal-item-input w-24 p-2 border border-gray-300 rounded-md text-right text-sm">
                </div>
                <div class="flex items-center">
                    <label class="text-sm text-gray-700 ml-1 whitespace-nowrap">בזבזתי (יח'):</label>
                    <input type="number" data-id="${item.id}" data-field="wastedQuantity" 
                           value="0" min="0" max="${item.quantity}"
                           class="modal-item-input w-20 p-2 border border-gray-300 rounded-md text-right text-sm">
                </div>
            </div>
        `;
        modalItemList.appendChild(itemEl);
    });

    modal.classList.remove('hidden');
}

function confirmFinalPurchase() {
    const modalItemList = document.getElementById('modal-item-list');
    const purchasedItemsWithDetails = [];
    let purchaseTotal = 0;
    let currentPurchaseWastedCost = 0;

    shoppingList.forEach(item => {
        const actualPriceInput = modalItemList.querySelector(`input[data-id="${item.id}"][data-field="actualPrice"]`);
        const wastedQuantityInput = modalItemList.querySelector(`input[data-id="${item.id}"][data-field="wastedQuantity"]`);
        
        const actualPrice = parseFloat(actualPriceInput?.value) || item.pricePerUnit || 0;
        const wastedQuantity = parseInt(wastedQuantityInput?.value) || 0;

        const itemTotal = (item.quantity || 1) * actualPrice;
        purchaseTotal += itemTotal;
        currentPurchaseWastedCost += wastedQuantity * actualPrice;

        purchasedItemsWithDetails.push({
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            category: item.category,
            actualPrice: actualPrice,
            wastedQuantity: wastedQuantity
        });
    });

    const newPurchase = {
        id: crypto.randomUUID(),
        purchaseDate: new Date().toISOString(),
        totalCost: purchaseTotal,
        items: purchasedItemsWithDetails,
        wastedCost: currentPurchaseWastedCost
    };
    purchaseHistory.push(newPurchase);
    saveData(DATA_KEYS.PURCHASE_HISTORY, purchaseHistory);

    updateItemPatterns(newPurchase.items);

    budgetData.monthlySpent += purchaseTotal;
    saveData(DATA_KEYS.BUDGET_DATA, budgetData);
    updateBudgetSummary();

    savingsData.totalWastedCost += currentPurchaseWastedCost;
    saveData(DATA_KEYS.SAVINGS_DATA, savingsData);
    updateSavingsSummary();

    shoppingList = [];
    saveData(DATA_KEYS.SHOPPING_LIST, shoppingList);
    renderShoppingList();

    alert('הקנייה הושלמה בהצלחה! המאסטרו למד עוד עליך.');
    document.getElementById('purchase-confirmation-modal').classList.add('hidden');
    renderFaceContent(targetFaceIndex); // רנדר מחדש את הדופן הנוכחית לאחר שינוי נתונים
}

function updateItemPatterns(purchasedItems) {
    const now = new Date();

    purchasedItems.forEach(pItem => {
        const itemName = pItem.name;
        if (!itemPatterns[itemName]) {
            itemPatterns[itemName] = {
                purchaseDates: [],
                quantitiesBought: [],
                quantitiesConsumed: [],
                lastPurchaseDate: null,
                avgDaysBetweenPurchases: 0,
                stdDevDays: 0,
                typicalQuantity: 0,
                lastKnownPrice: 0,
                correlationCounts: {},
                wastedQuantities: [],
                priceHistory: []
            };
        }

        const pattern = itemPatterns[itemName];
        
        pattern.purchaseDates.push(now.toISOString());
        pattern.quantitiesBought.push(pItem.quantity);
        pattern.quantitiesConsumed.push(pItem.quantity - (pItem.wastedQuantity || 0));

        if (pItem.actualPrice > 0) {
            pattern.lastKnownPrice = pItem.actualPrice;
            pattern.priceHistory.push({ date: now.toISOString(), price: pItem.actualPrice });
            if (pattern.priceHistory.length > 5) {
                pattern.priceHistory = pattern.priceHistory.slice(-5);
            }
        }

        if (pattern.purchaseDates.length > 1) {
            const daysDiffs = [];
            for (let i = 1; i < pattern.purchaseDates.length; i++) {
                const date1 = new Date(pattern.purchaseDates[i - 1]);
                const date2 = new Date(pattern.purchaseDates[i]);
                const diffTime = Math.abs(date2 - date1);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                daysDiffs.push(diffDays);
            }
            pattern.avgDaysBetweenPurchases = daysDiffs.reduce((a, b) => a + b, 0) / daysDiffs.length;
            
            const mean = pattern.avgDaysBetweenPurchases;
            const variance = daysDiffs.reduce((sum, diff) => sum + Math.pow(diff - mean, 2), 0) / daysDiffs.length;
            pattern.stdDevDays = Math.sqrt(variance);
        } else {
            pattern.avgDaysBetweenPurchases = 0;
            pattern.stdDevDays = 0;
        }

        const sumConsumedQuantities = pattern.quantitiesConsumed.reduce((a, b) => a + b, 0);
        pattern.typicalQuantity = sumConsumedQuantities / pattern.quantitiesConsumed.length;

        pattern.lastPurchaseDate = now.toISOString();

        purchasedItems.forEach(otherItem => {
            if (otherItem.name !== itemName) {
                pattern.correlationCounts[otherItem.name] = (pattern.correlationCounts[otherItem.name] || 0) + 1;
            }
        });

        if (pItem.wastedQuantity && pItem.wastedQuantity > 0) {
            pattern.wastedQuantities.push({
                date: now.toISOString(),
                quantity: pItem.wastedQuantity,
                cost: pItem.actualPrice * pItem.wastedQuantity
            });
        }
    });
    saveData(DATA_KEYS.ITEM_PATTERNS, itemPatterns);
}


function calculateItemPrediction(itemName) {
    const pattern = itemPatterns[itemName];
    if (!pattern || !pattern.lastPurchaseDate || pattern.avgDaysBetweenPurchases === 0) {
        return null;
    }

    const lastPurchaseDate = new Date(pattern.lastPurchaseDate);
    const predictedDays = pattern.avgDaysBetweenPurchases + pattern.stdDevDays;
    const predictedEndDate = new Date(lastPurchaseDate.getTime() + predictedDays * 24 * 60 * 60 * 1000);
    const now = new Date();
    const daysUntilEnd = Math.ceil((predictedEndDate - now) / (1000 * 60 * 60 * 24));

    let urgencyLevel;
    if (daysUntilEnd <= 0) {
        urgencyLevel = 'now';
    } else if (daysUntilEnd <= 3) {
        urgencyLevel = 'very-urgent';
    } else if (daysUntilEnd <= 7) {
        urgencyLevel = 'urgent';
    } else {
        urgencyLevel = 'low';
    }

    return {
        predictedEndDate: predictedEndDate.toLocaleDateString('he-IL'),
        daysUntilEnd: daysUntilEnd,
        urgencyLevel: urgencyLevel
    };
}


function getItemUrgencyClass(itemName) {
    const prediction = calculateItemPrediction(itemName);
    if (!prediction) return '';

    switch (prediction.urgencyLevel) {
        case 'now':
        case 'very-urgent':
            return 'border-r-4 border-red-500 animate-pulse-red';
        case 'urgent':
            return 'border-r-4 border-yellow-500';
        default:
            return '';
    }
}

function renderUrgentItems() {
    const urgentItemsListEl = document.getElementById('urgent-items-list');
    if (!urgentItemsListEl) return;

    urgentItemsListEl.innerHTML = '';

    const urgentItems = [];

    for (const itemName in itemPatterns) {
        const prediction = calculateItemPrediction(itemName);
        if (!prediction) continue;

        const isInShoppingList = shoppingList.some(item => item.name === itemName);

        if (prediction.daysUntilEnd <= 7 && prediction.daysUntilEnd >= -3 && !isInShoppingList) {
            urgentItems.push({
                name: itemName,
                ...prediction
            });
        }
    }

    if (urgentItems.length === 0) {
        urgentItemsListEl.innerHTML = '<p class="text-gray-500">כרגע אין פריטים דחופים במיוחד.</p>';
        return;
    }

    urgentItems.sort((a, b) => a.daysUntilEnd - b.daysUntilEnd);

    urgentItems.forEach(item => {
        let icon = '';
        let colorClass = '';
        if (item.urgencyLevel === 'now' || item.urgencyLevel === 'very-urgent') {
            icon = '🔥';
            colorClass = 'text-red-800 bg-red-50 border-red-200';
        } else if (item.urgencyLevel === 'urgent') {
            icon = '⚠️';
            colorClass = 'text-yellow-800 bg-yellow-50 border-yellow-200';
        }

        const daysText = item.daysUntilEnd <= 0 ? 'נגמר!' : `בעוד ${item.daysUntilEnd} ימים`;

        const itemEl = document.createElement('div');
        itemEl.className = `flex items-center justify-between p-2 rounded-md border ${colorClass}`;
        itemEl.innerHTML = `
            <span class="font-medium flex items-center">${icon} ${item.name}</span>
            <span class="text-sm">${daysText}</span>
            <button data-name="${item.name}" class="add-to-list-from-suggestion bg-blue-100 text-blue-700 px-3 py-1 rounded-md text-sm hover:bg-blue-200 transition">הוסף</button>
        `;
        urgentItemsListEl.appendChild(itemEl);
    });

    document.querySelectorAll('.add-to-list-from-suggestion').forEach(button => {
        button.addEventListener('click', (e) => {
            const itemName = e.target.dataset.name;
            const itemPattern = itemPatterns[itemName];
            const typicalQuantity = Math.ceil(itemPattern?.typicalQuantity || 1);
            addItemToList(itemName, typicalQuantity, itemPattern?.category || 'Other', itemPattern?.lastKnownPrice || 0);
            renderUrgentItems();
            hideMaestroPrompt();
        });
    });
}

function renderSmartSuggestions() {
    const smartSuggestionsListEl = document.getElementById('smart-suggestions-list');
    if (!smartSuggestionsListEl) return;

    smartSuggestionsListEl.innerHTML = '';

    const suggestions = new Set();

    shoppingList.forEach(listItem => {
        const pattern = itemPatterns[listItem.name];
        if (pattern && pattern.correlationCounts) {
            const correlatedItems = Object.entries(pattern.correlationCounts)
                .sort(([, countA], [, countB]) => countB - countA)
                .slice(0, 3);

            correlatedItems.forEach(([corrItemName, count]) => {
                const isInShoppingList = shoppingList.some(item => item.name === corrItemName);
                const prediction = calculateItemPrediction(corrItemName);
                const isUrgent = prediction && (prediction.daysUntilEnd <= 7 && prediction.daysUntilEnd >= -3);

                if (!isInShoppingList && !isUrgent) {
                    suggestions.add(corrItemName);
                }
            });
        }
    });

    for (const itemName in itemPatterns) {
        const pattern = itemPatterns[itemName];
        if (pattern.wastedQuantities && pattern.wastedQuantities.length > 0) {
            const totalWasted = pattern.wastedQuantities.reduce((sum, w) => sum + w.quantity, 0);
            const totalBought = pattern.quantitiesBought.reduce((sum, q) => sum + q, 0);
            if (totalBought > 0 && (totalWasted / totalBought) > 0.10) {
                const isInShoppingList = shoppingList.some(item => item.name === itemName);
                if (!isInShoppingList) {
                    suggestions.add(`פחות ${itemName} (נמנע מבזבוז)`);
                }
            }
        }
    }

    for (const itemName in itemPatterns) {
        const pattern = itemPatterns[itemName];
        if (pattern.priceHistory && pattern.priceHistory.length > 1) {
            const currentAvgPrice = pattern.priceHistory.reduce((sum, p) => sum + p.price, 0) / pattern.priceHistory.length;
            const lastPrice = pattern.lastKnownPrice;

            if (lastPrice > currentAvgPrice * 1.1) {
                 const isInShoppingList = shoppingList.some(item => item.name === itemName);
                 if (!isInShoppingList) {
                    suggestions.add(`שקול מחיר ${itemName} (מצא חלופה זולה)`);
                 }
            }
        }
    }

    if (suggestions.size === 0) {
        smartSuggestionsListEl.innerHTML = '<p class="text-gray-500">אין הצעות חכמות כרגע.</p>';
        return;
    }

    suggestions.forEach(itemName => {
        const itemEl = document.createElement('div');
        itemEl.className = 'flex items-center justify-between bg-purple-50 p-2 rounded-md border border-purple-200';
        
        let displayItemName = itemName;
        let actionText = 'הוסף';
        let isWasteSuggestion = false;
        let isPriceSuggestion = false;

        if (itemName.includes('(נמנע מבזבוז)')) {
            displayItemName = itemName.replace('(נמנע מבזבוז)', '').trim();
            actionText = 'שקול כמות חכמה';
            isWasteSuggestion = true;
        } else if (itemName.includes('(מצא חלופה זולה)')) {
            displayItemName = itemName.replace('(מצא חלופה זולה)', '').trim();
            actionText = 'בדוק מחיר טוב יותר';
            isPriceSuggestion = true;
        }

        itemEl.innerHTML = `
            <span class="font-medium">${displayItemName}</span>
            <button data-name="${displayItemName}" data-is-waste-suggestion="${isWasteSuggestion}" data-is-price-suggestion="${isPriceSuggestion}" class="add-to-list-from-suggestion bg-purple-200 text-purple-800 px-3 py-1 rounded-md text-sm hover:bg-purple-300 transition">${actionText}</button>
        `;
        smartSuggestionsListEl.appendChild(itemEl);
    });
    
    document.querySelectorAll('.add-to-list-from-suggestion').forEach(button => {
        button.addEventListener('click', (e) => {
            const itemName = e.target.dataset.name;
            const isWasteSuggestion = e.target.dataset.isWasteSuggestion === 'true';
            const isPriceSuggestion = e.target.dataset.isPriceSuggestion === 'true';
            const itemPattern = itemPatterns[itemName];
            const typicalQuantity = Math.ceil(itemPattern?.typicalQuantity || 1);
            
            if (isWasteSuggestion) {
                showMaestroPrompt(
                    `המאסטרו מציע לשקול את הכמות של ${itemName}. בעבר נזרקה ממנו כמות, וכמות קטנה יותר יכולה לחסוך לך כסף. מה תרצה לעשות?`,
                    [{
                        text: `הוסף כמות רגילה (${typicalQuantity})`,
                        action: () => addItemToList(itemName, typicalQuantity, itemPattern?.category || 'Other', itemPattern?.lastKnownPrice || 0),
                        isPrimary: true
                    }, {
                        text: 'הוסף כמות חכמה (פחות)',
                        action: () => {
                            const newQuantity = prompt(`המאסטרו ממליץ על כמות מופחתת. כמה יחידות תרצה להוסיף עבור ${itemName}?`, Math.floor(typicalQuantity * 0.75));
                            if (newQuantity && !isNaN(newQuantity) && parseInt(newQuantity) > 0) {
                                addItemToList(itemName, newQuantity, itemPattern?.category || 'Other', itemPattern?.lastKnownPrice || 0);
                                if (itemPattern && itemPattern.wastedQuantities.length > 0) {
                                    const avgWastedCostPerUnit = itemPattern.wastedQuantities.reduce((sum, w) => sum + w.cost / w.quantity, 0) / itemPattern.wastedQuantities.length;
                                    const savedAmount = (typicalQuantity - parseInt(newQuantity)) * avgWastedCostPerUnit;
                                    if (savedAmount > 0) {
                                        savingsData.totalSavings += savedAmount;
                                        saveData(DATA_KEYS.SAVINGS_DATA, savingsData);
                                        updateSavingsSummary();
                                        showMaestroPrompt(`מעולה! חסכת ₪${savedAmount.toFixed(2)} על ידי בחירה בכמות חכמה יותר של ${itemName}.`);
                                    }
                                }
                            }
                        },
                    }]
                );
            } else if (isPriceSuggestion) {
                const currentAvgPrice = itemPattern.priceHistory.reduce((sum, p) => sum + p.price, 0) / pattern.priceHistory.length;
                const lastPrice = itemPattern.lastKnownPrice;
                const potentialSavingsPerUnit = lastPrice - currentAvgPrice;

                showMaestroPrompt(
                    `המאסטרו מציע לבדוק את מחיר ה${itemName} - נראה שהוא גבוה מהממוצע ההיסטורי (₪${currentAvgPrice.toFixed(2)} ליח', כרגע ₪${lastPrice.toFixed(2)}). אולי יש חלופה זולה יותר או מבצע?`,
                    [{
                        text: 'אחפש חלופה זולה',
                        action: () => {
                            const savedAmount = prompt(`כמה הצלחת לחסוך בפועל על יחידה אחת של ${itemName}?`, potentialSavingsPerUnit.toFixed(2));
                            if (savedAmount && !isNaN(savedAmount) && parseFloat(savedAmount) > 0) {
                                savingsData.totalSavings += parseFloat(savedAmount) * typicalQuantity;
                                saveData(DATA_KEYS.SAVINGS_DATA, savingsData);
                                updateSavingsSummary();
                                showMaestroPrompt(`מעולה! חסכת ₪${(parseFloat(savedAmount) * typicalQuantity).toFixed(2)} על ${itemName}.`);
                            }
                            addItemToList(itemName, typicalQuantity, itemPattern?.category || 'Other', itemPattern?.lastKnownPrice || 0);
                        },
                        isPrimary: true
                    }, {
                        text: 'הוסף בכל זאת',
                        action: () => addItemToList(itemName, typicalQuantity, itemPattern?.category || 'Other', itemPattern?.lastKnownPrice || 0)
                    }]
                );
            }
            else {
                addItemToList(itemName, typicalQuantity, itemPattern?.category || 'Other', itemPattern?.lastKnownPrice || 0);
            }
            renderSmartSuggestions();
            hideMaestroPrompt();
        });
    });
}

function showMaestroPrompt(message, actions = []) {
    const promptEl = document.getElementById('maestro-prompt');
    const promptTextEl = document.getElementById('maestro-prompt-text');
    const promptActionsEl = document.getElementById('maestro-prompt-actions');

    if (!promptEl) return;

    promptTextEl.textContent = message;
    promptActionsEl.innerHTML = '';

    actions.forEach(action => {
        const button = document.createElement('button');
        button.textContent = action.text;
        button.className = `px-4 py-2 rounded-md transition duration-300 ease-in-out ${action.isPrimary ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`;
        button.onclick = () => {
            action.action();
            hideMaestroPrompt();
        };
        promptActionsEl.appendChild(button);
    });

    promptEl.classList.remove('hidden');
}

function hideMaestroPrompt() {
    const promptEl = document.getElementById('maestro-prompt');
    if (promptEl) {
        promptEl.classList.add('hidden');
    }
}


// --- פונקציות לתקציב מתקדם ---

function checkItemBudgetImpact(item) {
    if (budgetData.monthlyBudget === 0) return '';

    const currentProjectedTotal = shoppingList.reduce((sum, current) => {
        const price = current.pricePerUnit || itemPatterns[current.name]?.lastKnownPrice || 0;
        return sum + (current.quantity || 1) * price;
    }, 0);

    const projectedTotalSpend = budgetData.monthlySpent + currentProjectedTotal;

    if (budgetData.monthlyBudget > 0 && projectedTotalSpend > budgetData.monthlyBudget * 1.1) {
        return 'border-l-4 border-orange-500';
    } else if (budgetData.monthlyBudget > 0 && projectedTotalSpend > budgetData.monthlyBudget * 0.9) {
        return 'border-l-4 border-yellow-500';
    }
    return '';
}

function checkOverallBudgetAlert() {
    // אל תציג התראת תקציב אם פרומפט אחר כבר מוצג
    if (document.getElementById('maestro-prompt') && !document.getElementById('maestro-prompt').classList.contains('hidden')) {
        return;
    }

    const shoppingListCurrentCost = shoppingList.reduce((sum, item) => {
        const price = item.pricePerUnit || itemPatterns[item.name]?.lastKnownPrice || 0;
        return sum + (item.quantity || 1) * price;
    }, 0);

    const projectedTotalSpend = budgetData.monthlySpent + shoppingListCurrentCost;

    const newPromptText = `המאסטרו רואה שעלות הקנייה הנוכחית עלולה להביא אותך לחרוג מתקציב ה-₪${budgetData.monthlyBudget.toFixed(2)} שלך!`;

    if (budgetData.monthlyBudget > 0 && projectedTotalSpend > budgetData.monthlyBudget) {
        showMaestroPrompt(
            newPromptText,
            [{
                text: 'הבנתי',
                action: () => console.log('User acknowledged budget warning.')
            }, {
                text: 'הצג הצעות לחיסכון',
                action: showMaestroPromptForSaving
            }]
        );
    }
}

function showMaestroPromptForSaving() {
    const sortedItems = [...shoppingList].sort((a, b) => {
        const priceA = a.pricePerUnit || itemPatterns[a.name]?.lastKnownPrice || 0;
        const priceB = b.pricePerUnit || itemPatterns[b.name]?.lastKnownPrice || 0;
        return (b.quantity * priceB) - (a.quantity * priceA);
    });

    const savingSuggestions = [];
    if (sortedItems.length > 0) {
        const highestCostItem = sortedItems[0];
        const highestCost = (highestCostItem.quantity || 1) * (highestCostItem.pricePerUnit || itemPatterns[highestCostItem.name]?.lastKnownPrice || 0);
        
        savingSuggestions.push({
            text: `הסר את ${highestCostItem.name} (יחסוך ₪${highestCost.toFixed(2)})`,
            action: () => removeItemFromList(highestCostItem.id),
            isPrimary: true
        });

        const itemPattern = itemPatterns[highestCostItem.name];
        if (itemPattern && itemPattern.priceHistory.length > 1) {
            const currentAvgPrice = itemPattern.priceHistory.reduce((sum, p) => sum + p.price, 0) / itemPattern.priceHistory.length;
            const cheapestHistoricalPrice = itemPattern.priceHistory.reduce((min, p) => Math.min(min, p.price), itemPattern.priceHistory[0].price);
            
            if (highestCostItem.pricePerUnit > cheapestHistoricalPrice) {
                const potentialSavings = (highestCostItem.pricePerUnit - cheapestHistoricalPrice) * highestCostItem.quantity;
                if (potentialSavings > 0.01) {
                    savingSuggestions.push({
                        text: `נסה למצוא ${highestCostItem.name} במחיר של ₪${cheapestHistoricalPrice.toFixed(2)} (פוטנציאל חיסכון ₪${potentialSavings.toFixed(2)})`,
                        action: () => {
                            const actualSaved = prompt(`כמה הצלחת לחסוך בפועל על ${highestCostItem.name}?`, potentialSavings.toFixed(2));
                            if (actualSaved && !isNaN(actualSaved) && parseFloat(actualSaved) > 0) {
                                savingsData.totalSavings += parseFloat(actualSaved);
                                saveData(DATA_KEYS.SAVINGS_DATA, savingsData);
                                updateSavingsSummary();
                                showMaestroPrompt(`מעולה! חסכת ₪${parseFloat(actualSaved).toFixed(2)} על ${highestCostItem.name}.`);
                            }
                        }
                    });
                }
            }
        }
    }

    if (savingSuggestions.length === 0) {
        savingSuggestions.push({text: 'אין הצעות חיסכון קונקרטיות כרגע. כל הכבוד!', action: hideMaestroPrompt});
    }

    showMaestroPrompt("המאסטרו מציע דרכים לייעל את הקנייה ולחסוך:", savingSuggestions);
}


function checkItemAdditionPrompts(newItem) {
    // אל תציג פרומפט אם פרומפט אחר כבר מוצג
    if (document.getElementById('maestro-prompt') && !document.getElementById('maestro-prompt').classList.contains('hidden')) {
        return;
    }

    const pattern = itemPatterns[newItem.name];
    if (pattern && pattern.avgDaysBetweenPurchases > 0) {
        const lastPurchaseDate = new Date(pattern.lastPurchaseDate);
        const daysSinceLastPurchase = Math.ceil((new Date() - lastPurchaseDate) / (1000 * 60 * 60 * 24));

        if (daysSinceLastPurchase > pattern.avgDaysBetweenPurchases * 1.5) {
            showMaestroPrompt(
                `המאסטרו שם לב שלא קנית ${newItem.name} כבר ${daysSinceLastPurchase} ימים (בממוצע אתה קונה כל ${Math.round(pattern.avgDaysBetweenPurchases)} ימים). נשמח אם תעדכן את כמות הצריכה שלך או תבחן את הרגלי הקנייה שלך לפריט זה.`,
                [{
                    text: 'הבנתי',
                    action: () => console.log('User acknowledged long gap.')
                }]
            );
        } else if (newItem.quantity > pattern.typicalQuantity * 1.5 && pattern.typicalQuantity > 0) {
            showMaestroPrompt(
                `המאסטרו רואה שאתה מוסיף ${newItem.quantity} יחידות של ${newItem.name}. בדרך כלל אתה קונה ${Math.round(pattern.typicalQuantity)}. האם אתה בטוח שזו הכמות הרצויה, או שאולי עדיף להפחית כדי למנוע בזבוז?`,
                [{
                    text: 'כן, בטוח.',
                    action: () => console.log('User confirmed quantity.')
                }, {
                    text: 'שנה לכמות טיפוסית',
                    action: () => {
                        const itemToUpdate = shoppingList.find(item => item.id === newItem.id);
                        if (itemToUpdate) {
                            itemToUpdate.quantity = Math.round(pattern.typicalQuantity);
                            saveData(DATA_KEYS.SHOPPING_LIST, shoppingList);
                            renderShoppingList();
                            const originalCost = newItem.quantity * (newItem.pricePerUnit || itemPatterns[newItem.name]?.lastKnownPrice || 0);
                            const newCost = Math.round(pattern.typicalQuantity) * (newItem.pricePerUnit || itemPatterns[newItem.name]?.lastKnownPrice || 0);
                            const savedAmount = originalCost - newCost;
                            if (savedAmount > 0) {
                                savingsData.totalSavings += savedAmount;
                                saveData(DATA_KEYS.SAVINGS_DATA, savingsData);
                                updateSavingsSummary();
                                showMaestroPrompt(`מעולה! חסכת ₪${savedAmount.toFixed(2)} על ידי התאמת הכמות של ${newItem.name}.`);
                            }
                        }
                    },
                    isPrimary: true
                }]
            );
        }
    }
}


// --- Event Listeners הכלליים של האפליקציה ---
document.addEventListener('DOMContentLoaded', initializeData);

document.getElementById('add-item-btn')?.addEventListener('click', () => { // וודא שהאלמנט קיים
    const name = document.getElementById('item-name-input').value;
    const quantity = document.getElementById('item-quantity-input').value;
    const price = document.getElementById('item-price-input').value;
    const category = document.getElementById('item-category-select').value;

    if (name.trim() === '') {
        alert('אנא הזן שם פריט.');
        return;
    }

    addItemToList(name, quantity, category, price);

    document.getElementById('item-name-input').value = '';
    document.getElementById('item-quantity-input').value = '';
    document.getElementById('item-price-input').value = '';
    document.getElementById('item-category-select').value = '';
    
    renderSmartSuggestions();
    checkOverallBudgetAlert();
});

document.getElementById('complete-purchase-btn')?.addEventListener('click', initiatePurchaseConfirmation);
document.getElementById('close-modal-btn')?.addEventListener('click', () => {
    document.getElementById('purchase-confirmation-modal').classList.add('hidden');
});
document.getElementById('confirm-final-purchase-btn')?.addEventListener('click', confirmFinalPurchase);


document.getElementById('save-budget-btn')?.addEventListener('click', () => {
    const newBudget = parseFloat(document.getElementById('set-monthly-budget').value);
    if (!isNaN(newBudget) && newBudget >= 0) {
        budgetData.monthlyBudget = newBudget;
        saveData(DATA_KEYS.BUDGET_DATA, budgetData);
        updateBudgetSummary();
        alert('התקציב החודשי נשמר בהצלחה!');
        checkOverallBudgetAlert();
    } else {
        alert('אנא הזן מספר חוקי עבור התקציב.');
    }
});


document.getElementById('item-name-input')?.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const suggestionsEl = document.getElementById('autocomplete-suggestions');
    if (!suggestionsEl) return;

    suggestionsEl.innerHTML = '';

    if (query.length < 2) {
        suggestionsEl.classList.add('hidden');
        return;
    }

    const matchedItems = Object.keys(itemPatterns).filter(name =>
        name.toLowerCase().includes(query)
    );

    if (matchedItems.length > 0) {
        matchedItems.forEach(name => {
            const div = document.createElement('div');
            div.className = 'p-2 cursor-pointer hover:bg-blue-100 text-right';
            div.textContent = name;
            div.onclick = () => {
                document.getElementById('item-name-input').value = name;
                const pattern = itemPatterns[name];
                if (pattern) {
                    document.getElementById('item-quantity-input').value = Math.ceil(pattern.typicalQuantity || 1);
                    document.getElementById('item-category-select').value = pattern.category || 'Other';
                    document.getElementById('item-price-input').value = pattern.lastKnownPrice > 0 ? pattern.lastKnownPrice.toFixed(2) : '';
                }
                suggestionsEl.classList.add('hidden');
            };
            suggestionsEl.appendChild(div);
        });
        suggestionsEl.classList.add('hidden'); // הסתר אחרי בחירה
    } else {
        suggestionsEl.classList.add('hidden');
    }
});

document.addEventListener('click', (e) => {
    const suggestionsEl = document.getElementById('autocomplete-suggestions');
    const inputEl = document.getElementById('item-name-input');
    if (suggestionsEl && inputEl && !suggestionsEl.contains(e.target) && e.target !== inputEl) {
        suggestionsEl.classList.add('hidden');
    }
});

// **--- Event Listeners עבור הקוביה התלת-ממדית (מעכשיו גרירה מכל מקום בתוך הקוביה) ---**

if (maestroCube) { // וודא שהאלמנט קיים
    // הוספת event listeners למיכל הקוביה עצמו
    maestroCube.addEventListener('mousedown', startDrag);
    maestroCube.addEventListener('touchstart', startDrag, { passive: true });

    // ה-mousemove וה-mouseup נשארים על ה-document.body
    // כדי לאפשר גרירה גם כשהעכבר יוצא מטווח הקוביה/מושך
    document.body.addEventListener('mousemove', drag);
    document.body.addEventListener('touchmove', drag, { passive: true });
    document.body.addEventListener('mouseup', endDrag);
    document.body.addEventListener('touchend', endDrag);
    document.body.addEventListener('mouseleave', (e) => {
        if (isDragging) endDrag(e);
    });
}


function startDrag(e) {
    isDragging = true;
    startX = (e.clientX || e.touches[0].clientX);
    maestroCube.style.transition = 'none'; // בטל אנימציה בזמן גרירה
    document.body.style.cursor = 'grabbing'; // שנה סמן העכבר
}

function drag(e) {
    if (!isDragging) return;

    const currentX = (e.clientX || e.touches[0].clientX);
    const deltaX = currentX - startX;

    currentRotationY += deltaX * 0.7; // גורם רגישות לסיבוב - ניתן לכוונן
    maestroCube.style.setProperty('--rotateY', `${currentRotationY}deg`);
    startX = currentX;
}

function endDrag() {
    isDragging = false;
    maestroCube.style.transition = 'transform 0.5s ease-out'; // החזר אנימציה

    const anglePerFace = 90; // כל דופן היא 90 מעלות

    // נרמל את הזווית הנוכחית כדי למצוא לאיזו "קבוצת" 90 מעלות אנחנו קרובים
    let roundedRotation = Math.round(currentRotationY / anglePerFace) * anglePerFace;

    // לוודא שהסיבוב נשאר בטווח סביר ושמתיישר לזוויות מדויקות
    currentRotationY = roundedRotation;
    maestroCube.style.setProperty('--rotateY', `${currentRotationY}deg`);

    // חשב את האינדקס של הדופן המוצגת
    // נרמל לטווח 0-359 ואז חלוקה
    let normalizedTargetRotation = currentRotationY % 360;
    if (normalizedTargetRotation < 0) {
        normalizedTargetRotation += 360;
    }
    // החלוקה ב-90 תיתן 0, 1, 2, 3 לאינדקסים של הדפנות
    targetFaceIndex = Math.round(normalizedTargetRotation / anglePerFace);

    // לוודא שהאינדקס הוא בטווח 0-3 (יש לנו 4 דפנות)
    targetFaceIndex = targetFaceIndex % 4;

    // רנדר את התוכן של הדופן החדשה
    renderFaceContent(targetFaceIndex);

    document.body.style.cursor = 'grab'; // החזר סמן עכבר רגיל
}

// --- Event Listeners לדופן 4: הגדרות ---
document.getElementById('save-user-name-btn')?.addEventListener('click', () => {
    const newName = document.getElementById('user-name-setting').value.trim();
    if (newName) {
        userSettings.userName = newName;
        saveData(DATA_KEYS.USER_SETTINGS, userSettings);
        updateUserName();
        alert('שם המשתמש נשמר בהצלחה!');
    } else {
        alert('אנא הזן שם משתמש.');
    }
});

document.getElementById('reset-all-data-btn')?.addEventListener('click', () => {
    if (confirm('האם אתה בטוח שברצונך למחוק את כל הנתונים? פעולה זו בלתי הפיכה!')) {
        localStorage.clear();
        alert('כל הנתונים נמחקו. האפליקציה תוטען מחדש.');
        window.location.reload();
    }
});