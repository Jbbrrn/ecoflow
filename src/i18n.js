export const translations = {
  en: {
    // Language toggle
    'language.englishShort': 'EN',
    'language.filipinoShort': 'FIL',
    'language.toggle.aria': 'Select website language',

    // Header / landing
    'header.login': 'Login',
    'header.nav.home': 'Home',
    'header.nav.features': 'Features',
    'header.nav.about': 'About',

    // Sidebar navigation
    'nav.navigation': 'NAVIGATION',
    'nav.dashboard': 'Dashboard',
    'nav.manualControls': 'Manual Controls',
    'nav.reports': 'Generate Reports',
    'nav.manageAccounts': 'Manage Accounts',
    'sidebar.logout': 'Logout',
    'sidebar.role.admin': 'Administrator',
    'sidebar.role.user': 'User',

    // Chatbot
    'chatbot.title': 'EcoBot',
    'chatbot.subtitle': 'Your AI irrigation assistant',
    'chatbot.greeting': "Hello! I'm EcoBot, your AI irrigation assistant. I can help you with:",
    'chatbot.greeting.item1': 'Current soil conditions and sensor readings',
    'chatbot.greeting.item2': 'Crop suitability based on environmental data',
    'chatbot.placeholder': 'Ask me about your irrigation system...',
    'chatbot.example1': 'What is the current soil moisture level?',
    'chatbot.example2': 'What crops are suitable?',
    'chatbot.example3': 'When should I water my plants?',

    // Plant condition summary
    'plantSummary.title': 'Plant Condition Summary',
    'plantSummary.status.good': 'Plants are in good condition',
    'plantSummary.status.fair': 'Plants are in fair condition',
    'plantSummary.status.needsAttention': 'Plants need attention',
    'plantSummary.overallScoreLabel': 'Overall Health Score',
    'plantSummary.attentionHeading': 'Attention Needed',

    // Analytics explanatory text
    'analytics.soilTrendsTitle': 'Soil Moisture Trends',
    'analytics.soilTrendsBody':
      'Track how soil moisture changes over time. The dashed green line shows the target range start (70%). Ideally, all three sensors should stay between 70–89% for healthy plants.',
    'analytics.tempHumTrendsTitle': 'Temperature & Humidity Trends',
    'analytics.tempHumTrendsBody':
      'See how temperature (red) and humidity (blue) change together. Temperature is measured in Celsius (°C) on the left, humidity in percentage (%) on the right. These two factors work together to create the perfect growing environment.',

    // Manual controls (header + cards)
    'controls.header.title': 'Manual Controls',
    'controls.header.whatIs': 'What are Manual Controls?',
    'controls.header.description':
      'Manual controls allow you to override the automatic irrigation system and manually operate the water pump and valve when needed. This is useful for testing, maintenance, or when you want to water your plants immediately.',
    'controls.header.howTo': '📋 How to Use:',
    'controls.header.step1': 'Click the toggle switch on any control card to turn it ON or OFF.',
    'controls.header.step2': 'The switch will show "Active" when the device is running.',
    'controls.header.step3': 'Monitor the status indicator to see if the command was successful.',
    'controls.header.step4': 'Remember to turn OFF manual controls when done to return to automatic mode.',
    'controls.header.legend.green': 'Green: Device is active and running',
    'controls.header.legend.yellow': 'Yellow: Command is pending',
    'controls.header.legend.gray': 'Gray: Device is inactive',

    'controls.card.pump.main': 'Manually activate the sprinkler system',
    'controls.card.pump.detail':
      'Click the switch to turn on the water pump and start watering your plants through the sprinkler system.',
    'controls.card.pump.actionOn': 'Sprinkler is running',
    'controls.card.pump.actionOff': 'Click to start sprinkler',

    'controls.card.valve.main': 'Manually fill the water tank',
    'controls.card.valve.detail':
      'Click the switch to open the valve and fill the water tank. This ensures you have enough water for irrigation.',
    'controls.card.valve.actionOn': 'Tank is filling',
    'controls.card.valve.actionOff': 'Click to fill tank',

    'controls.card.generic.main': 'Manual control override',
    'controls.card.generic.detail': 'Use this switch to manually control the system.',
    'controls.card.generic.actionOn': 'Active',
    'controls.card.generic.actionOff': 'Inactive',

    // Reports explanatory text
    'reports.sensorSummary.description':
      'This report gives an overview of temperature, humidity, and soil moisture over time so you can quickly see whether the greenhouse stayed in a healthy range for your plants.',
    'reports.waterUsage.description':
      'This report shows how much water the system used, how long the pump and valve were ON, and how much electricity was spent to deliver that water during the selected dates.',
    'reports.userActivity.description':
      'This report summarizes which accounts are using the system, how many commands each user sends, and whether their accounts are active or inactive.',
    'reports.deviceCommands.description':
      'This report shows how often the system was told to turn the pump and valve ON or OFF, how many of those commands were successful, and which users sent them.',
    'reports.energyConsumption.description':
      'This report explains how much electricity the irrigation system and devices (RPi and ESP32) used each day, so you can estimate the energy cost of running Eco Flow.',
  },
  fil: {
    // Language toggle
    'language.englishShort': 'EN',
    'language.filipinoShort': 'FIL',
    'language.toggle.aria': 'Piliin ang wika ng website',

    // Header / landing (keep login in English)
    'header.login': 'Login',
    'header.nav.home': 'Home',
    'header.nav.features': 'Mga Tampok',
    'header.nav.about': 'Tungkol',

    // Sidebar navigation (keep these in English even in Filipino mode)
    'nav.navigation': 'NAVIGATION',
    'nav.dashboard': 'Dashboard',
    'nav.manualControls': 'Manual Controls',
    'nav.reports': 'Generate Reports',
    'nav.manageAccounts': 'Manage Accounts',
    'sidebar.logout': 'Logout',
    'sidebar.role.admin': 'Administrator',
    'sidebar.role.user': 'User',

    // Chatbot
    'chatbot.title': 'EcoBot',
    'chatbot.subtitle': 'Iyong AI irrigation assistant',
    'chatbot.greeting': 'Kumusta! Ako si EcoBot, ang iyong AI irrigation assistant. Makakatulong ako sa iyo sa:',
    'chatbot.greeting.item1': 'Kasalukuyang kondisyon ng lupa at mga sensor',
    'chatbot.greeting.item2': 'Angkop na pananim base sa datos ng kapaligiran',
    'chatbot.placeholder': 'Magtanong tungkol sa iyong irrigation system...',
    'chatbot.example1': 'Ano ang kasalukuyang soil moisture level?',
    'chatbot.example2': 'Anong mga pananim ang angkop?',
    'chatbot.example3': 'Kailan ko dapat diligan ang mga halaman?',

    // Plant condition summary
    'plantSummary.title': 'Buod ng Kalagayan ng Halaman',
    'plantSummary.status.good': 'Maganda ang kalagayan ng mga halaman',
    'plantSummary.status.fair': 'Katamtaman ang kalagayan ng mga halaman',
    'plantSummary.status.needsAttention': 'Kailangan ng dagdag na pag-aalaga ang mga halaman',
    'plantSummary.overallScoreLabel': 'Kabuuang Health Score',
    'plantSummary.attentionHeading': 'Kailangang Atensyon',

    // Analytics explanatory text
    'analytics.soilTrendsTitle': 'Galaw ng Soil Moisture',
    'analytics.soilTrendsBody':
      'Subaybayan kung paano nagbabago ang soil moisture sa paglipas ng oras. Ipinapakita ng berdeng putol-putol na linya ang simula ng target range (70%). Mas mainam kung mananatili ang lahat ng tatlong sensor sa pagitan ng 70–89% para sa malusog na halaman.',
    'analytics.tempHumTrendsTitle': 'Galaw ng Temperatura at Humidity',
    'analytics.tempHumTrendsBody':
      'Makita kung paano sabay nagbabago ang temperatura (pula) at humidity (asul). Ang temperatura ay nasa Celsius (°C) sa kaliwa, at ang humidity ay porsyento (%) sa kanan. Magkasama silang bumubuo ng tamang kundisyon para sa paglago ng mga halaman.',

    // Manual controls (header + cards)
    'controls.header.title': 'Manwal na Kontrol',
    'controls.header.whatIs': 'Ano ang Manual Controls?',
    'controls.header.description':
      'Hinahayaan ka ng manual controls na higitan o i-override ang automatic irrigation system at manu-manong paandarin ang water pump at valve kapag kailangan. Kapaki-pakinabang ito para sa testing, maintenance, o kung gusto mong madiligan agad ang mga halaman.',
    'controls.header.howTo': '📋 Paano Gamitin:',
    'controls.header.step1': 'I-click ang toggle switch sa anumang control card para buksan o patayin ito (ON o OFF).',
    'controls.header.step2': 'Magpapakita ng “Active” ang switch kapag umaandar ang device.',
    'controls.header.step3': 'Tingnan ang status indicator para malaman kung naging matagumpay ang command.',
    'controls.header.step4': 'Huwag kalimutang i-OFF ang manual controls kapag tapos ka na para bumalik sa automatic mode.',
    'controls.header.legend.green': 'Berde: Umaandar at aktibo ang device',
    'controls.header.legend.yellow': 'Dilaw: Naka-pending pa ang command',
    'controls.header.legend.gray': 'Abu-abo: Hindi umaandar ang device',

    'controls.card.pump.main': 'Manu-manong paganahin ang sprinkler system',
    'controls.card.pump.detail':
      'I-click ang switch para paandarin ang water pump at simulan ang pagdidilig sa iyong mga halaman gamit ang sprinkler system.',
    'controls.card.pump.actionOn': 'Umaandar ang sprinkler',
    'controls.card.pump.actionOff': 'I-click para simulan ang sprinkler',

    'controls.card.valve.main': 'Manu-manong punuin ang water tank',
    'controls.card.valve.detail':
      'I-click ang switch para buksan ang valve at punuin ang water tank. Tinitiyak nito na may sapat kang tubig para sa irrigation.',
    'controls.card.valve.actionOn': 'Napupuno ang tank',
    'controls.card.valve.actionOff': 'I-click para punuin ang tank',

    'controls.card.generic.main': 'Manual na kontrol sa system',
    'controls.card.generic.detail': 'Gamitin ang switch na ito para mano-manong kontrolin ang system.',
    'controls.card.generic.actionOn': 'Aktibo',
    'controls.card.generic.actionOff': 'Hindi aktibo',

    // Reports explanatory text
    'reports.sensorSummary.description':
      'Ipinapakita ng ulat na ito ang kabuuang galaw ng temperatura, humidity, at soil moisture sa paglipas ng oras para madaling makita kung nanatiling nasa malusog na range ang greenhouse para sa iyong mga halaman.',
    'reports.waterUsage.description':
      'Ipinapakita ng ulat na ito kung gaano karaming tubig ang nagamit, gaano katagal naka-ON ang pump at valve, at gaano kalaking kuryente ang ginastos para maihatid ang tubig sa napiling petsa.',
    'reports.userActivity.description':
      'Buod ng ulat na ito kung aling mga account ang gumagamit ng system, gaano karaming command ang ipinapadala ng bawat user, at kung aktibo o hindi aktibo ang kanilang mga account.',
    'reports.deviceCommands.description':
      'Ipinapakita ng ulat na ito kung gaano kadalas inutusan ang system na buksan o patayin ang pump at valve, ilan sa mga command na iyon ang naging matagumpay, at aling mga user ang nagpadala ng mga ito.',
    'reports.energyConsumption.description':
      'Ipinaliliwanag ng ulat na ito kung gaano kalaking kuryente ang nagamit ng irrigation system at mga device (RPi at ESP32) bawat araw, para matantiya mo ang gastos sa enerhiya ng pagpapatakbo ng Eco Flow.',
  },
};

