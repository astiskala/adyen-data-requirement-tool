/* app.js */

let configData = null;

document.addEventListener("DOMContentLoaded", () => {
  fetch("fieldConfig.json")
    .then((resp) => resp.json())
    .then((json) => {
      configData = json;
      populateIndustries();
      populateCountries();
      setupTabs();
      setupEventListeners();
    })
    .catch((err) => {
      console.error("Error loading fieldConfig.json:", err);
    });
});

function populateIndustries() {
  const industrySelect = document.getElementById("industrySelect");
  const defaultOption = industrySelect.querySelector("option[value='']");
  industrySelect.innerHTML = "";
  industrySelect.appendChild(defaultOption);

  // Sort by label
  const sorted = [...configData.industries].sort((a, b) => a.label.localeCompare(b.label));
  sorted.forEach((ind) => {
    const opt = document.createElement("option");
    opt.value = ind.key;
    opt.textContent = ind.label;
    industrySelect.appendChild(opt);
  });
}

function populateCountries() {
  const countrySelect = document.getElementById("countrySelect");
  const defaultOption = countrySelect.querySelector("option[value='']");
  countrySelect.innerHTML = "";
  countrySelect.appendChild(defaultOption);

  // We keep them in the order provided in the JSON, or you could sort them
  configData.countryList.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.code;
    opt.textContent = c.name;
    countrySelect.appendChild(opt);
  });
}

function setupEventListeners() {
  const countrySelect = document.getElementById("countrySelect");
  countrySelect.addEventListener("change", () => {
    handleCountryChange();
  });

  document.getElementById("updateButton").addEventListener("click", updateRequiredFields);
}

// Show/hide relevant APMs based on the selected country
function handleCountryChange() {
  const selectedCountry = document.getElementById("countrySelect").value;
  const threeDSecureCheckbox = document.getElementById("threeDSecure");

  // SCA check
  const scaRequired = configData.scaCountries.includes(selectedCountry);
  if (scaRequired) {
    threeDSecureCheckbox.checked = true;
    threeDSecureCheckbox.disabled = true;
  } else {
    threeDSecureCheckbox.checked = false;
    threeDSecureCheckbox.disabled = false;
  }

  populateAPMs(selectedCountry);
}

function populateAPMs(selectedCountry) {
  const apmContainer = document.getElementById("apmContainer");
  const heading = apmContainer.querySelector("p");
  apmContainer.innerHTML = "";
  apmContainer.appendChild(heading);

  // If no country selected, show nothing
  if (!selectedCountry) {
    return;
  }

  // We do NOT sort the APMs in code; they are in desired order in the JSON
  configData.apms.forEach((apm) => {
    // Only show if selectedCountry is in apm.countriesAvailable
    if (apm.countriesAvailable.includes(selectedCountry)) {
      const label = document.createElement("label");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.classList.add("apmCheck");
      checkbox.value = apm.name;

      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(" " + apm.name));
      label.appendChild(document.createElement("br"));
      apmContainer.appendChild(label);
    }
  });
}

function setupTabs() {
  const tabButtons = document.querySelectorAll(".tab-button");
  const tabContents = document.querySelectorAll(".tab-content");

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      // Remove 'active' from all buttons
      tabButtons.forEach((b) => b.classList.remove("active"));
      // Remove 'active' from all tab-contents
      tabContents.forEach((tc) => tc.classList.remove("active"));

      // Mark this button as active
      btn.classList.add("active");
      // Show the corresponding tab
      const targetSelector = btn.getAttribute("data-target");
      const targetEl = document.querySelector(targetSelector);
      if (targetEl) {
        targetEl.classList.add("active");
      }
    });
  });
}

function updateRequiredFields() {
  if (!configData) return;

  // Collect user selections
  const industryKey = document.getElementById("industrySelect").value;
  const country = document.getElementById("countrySelect").value;
  const threeDSecure = document.getElementById("threeDSecure").checked;
  const protectLevel = document.getElementById("protectSelect").value;

  // Collect selected APMs
  const apmChecks = document.querySelectorAll(".apmCheck");
  const selectedAPMs = [];
  apmChecks.forEach((chk) => {
    if (chk.checked) selectedAPMs.push(chk.value);
  });

  // usageMap[fieldName] = Set of usage reasons
  const usageMap = {};

  function addUsage(field, usage) {
    if (!usageMap[field]) {
      usageMap[field] = new Set();
    }
    usageMap[field].add(usage);
  }

  // 1) Minimal fields
  configData.minimalFields.forEach((mf) => {
    addUsage(mf.field, mf.reason);
  });

  // 2) Industry-based
  if (industryKey) {
    const industryObj = configData.industries.find((i) => i.key === industryKey);
    if (industryObj && industryObj.requiredFields) {
      industryObj.requiredFields.forEach((rf) => {
        addUsage(rf.field, rf.reason);
      });
    }
  }

  // 3) APM-based
  selectedAPMs.forEach((apmName) => {
    const apmObj = configData.apms.find((a) => a.name === apmName);
    if (apmObj && apmObj.requiredFields) {
      apmObj.requiredFields.forEach((rf) => {
        addUsage(rf.field, rf.reason);
      });
    }
  });

  // 4) Protect Premium logic
  if (protectLevel === "premium") {
    addUsage("shopperEmail", "Protect Premium");
    addUsage("shopperReference", "Protect Premium");
  }

  // 5) If 3D Secure is checked, optionally highlight something
  if (threeDSecure) {
    // e.g.: addUsage("countryCode", "3D Secure");
  }

  // Combine base usage from each field
  for (const fieldName in configData.fields) {
    const base = configData.fields[fieldName].baseUsages || [];
    base.forEach((bu) => addUsage(fieldName, bu));
  }

  // Filter only fields that appear in usageMap => truly required
  const requiredFields = Object.keys(usageMap);

  renderFieldsTable(requiredFields, usageMap);
  renderSamplePayload(requiredFields);
}

function renderFieldsTable(requiredFields, usageMap) {
  const tbody = document.getElementById("fieldsTable").querySelector("tbody");
  tbody.innerHTML = "";

  requiredFields.forEach((fieldName) => {
    const fieldInfo = configData.fields[fieldName];
    if (!fieldInfo) return;

    const row = document.createElement("tr");

    // Property Name
    const nameCell = document.createElement("td");
    nameCell.textContent = fieldName;
    row.appendChild(nameCell);

    // Description
    const descCell = document.createElement("td");
    descCell.textContent = fieldInfo.description;
    row.appendChild(descCell);

    // Sample Data
    const sampleCell = document.createElement("td");
    sampleCell.textContent = fieldInfo.sampleData;
    row.appendChild(sampleCell);

    // Usages
    const usageCell = document.createElement("td");
    const usageSet = usageMap[fieldName] || new Set();
    usageSet.forEach((usage) => {
      usageCell.appendChild(createUsagePill(usage));
    });
    row.appendChild(usageCell);

    tbody.appendChild(row);
  });
}

function createUsagePill(usage) {
  const pill = document.createElement("span");
  pill.classList.add("usage-pill");
  pill.textContent = usage;
  // for color-coding
  pill.setAttribute("data-usage", usage);

  if (configData.usageDefinitions[usage]) {
    pill.setAttribute("data-tooltip", configData.usageDefinitions[usage]);
  } else {
    pill.setAttribute("data-tooltip", usage);
  }
  return pill;
}

function renderSamplePayload(requiredFields) {
  const payload = {};
  requiredFields.forEach((fieldName) => {
    const fieldInfo = configData.fields[fieldName];
    if (!fieldInfo) return;

    let sampleValue = fieldInfo.sampleData;
    // Attempt JSON parse if it starts/ends with { } or [ ]
    if (
      (sampleValue.startsWith("{") && sampleValue.endsWith("}")) ||
      (sampleValue.startsWith("[") && sampleValue.endsWith("]"))
    ) {
      try {
        sampleValue = JSON.parse(sampleValue);
      } catch (err) {
        // ignore parse error
      }
    }
    payload[fieldName] = sampleValue;
  });

  const sampleEl = document.getElementById("samplePayload");
  sampleEl.textContent = JSON.stringify(payload, null, 2);
}
