export default defineBackground(() => {
  // The toolbar button opens the side panel instead of a popup, so the panel
  // stays open next to the form while the user reviews values.
  void browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});
