const { ipcRenderer } = require('electron');

class SteamClient {
  constructor() {
    this.steamworks = null;
    this.isInitialized = false;
    this.appId = null; // You'll get this from Steam when you create your app
  }

  async initialize(appId) {
    try {
      // Initialize Steam API
      this.appId = appId;
      
      // Request Steam initialization from main process
      const result = await ipcRenderer.invoke('steam-init', appId);
      
      if (result.success) {
        this.isInitialized = true;
        console.log('Steam API initialized successfully');
        
        // Get user info
        const userInfo = await this.getUserInfo();
        console.log('Steam user:', userInfo);
        
        return true;
      } else {
        console.error('Failed to initialize Steam API:', result.error);
        return false;
      }
    } catch (error) {
      console.error('Steam initialization error:', error);
      return false;
    }
  }

  async getUserInfo() {
    if (!this.isInitialized) return null;
    
    try {
      return await ipcRenderer.invoke('steam-get-user-info');
    } catch (error) {
      console.error('Error getting user info:', error);
      return null;
    }
  }

  async unlockAchievement(achievementId) {
    if (!this.isInitialized) return false;
    
    try {
      const result = await ipcRenderer.invoke('steam-unlock-achievement', achievementId);
      return result.success;
    } catch (error) {
      console.error('Error unlocking achievement:', error);
      return false;
    }
  }

  async setStat(statName, value) {
    if (!this.isInitialized) return false;
    
    try {
      const result = await ipcRenderer.invoke('steam-set-stat', { statName, value });
      return result.success;
    } catch (error) {
      console.error('Error setting stat:', error);
      return false;
    }
  }

  async getLeaderboards() {
    if (!this.isInitialized) return [];
    
    try {
      return await ipcRenderer.invoke('steam-get-leaderboards');
    } catch (error) {
      console.error('Error getting leaderboards:', error);
      return [];
    }
  }

  async submitScore(leaderboardName, score) {
    if (!this.isInitialized) return false;
    
    try {
      const result = await ipcRenderer.invoke('steam-submit-score', { leaderboardName, score });
      return result.success;
    } catch (error) {
      console.error('Error submitting score:', error);
      return false;
    }
  }

  // Multiplayer lobbies
  async createLobby(maxPlayers = 4) {
    if (!this.isInitialized) return null;
    
    try {
      return await ipcRenderer.invoke('steam-create-lobby', maxPlayers);
    } catch (error) {
      console.error('Error creating lobby:', error);
      return null;
    }
  }

  async joinLobby(lobbyId) {
    if (!this.isInitialized) return false;
    
    try {
      const result = await ipcRenderer.invoke('steam-join-lobby', lobbyId);
      return result.success;
    } catch (error) {
      console.error('Error joining lobby:', error);
      return false;
    }
  }

  async findLobbies() {
    if (!this.isInitialized) return [];
    
    try {
      return await ipcRenderer.invoke('steam-find-lobbies');
    } catch (error) {
      console.error('Error finding lobbies:', error);
      return [];
    }
  }

  // Rich presence
  async setRichPresence(status, details = '') {
    if (!this.isInitialized) return false;
    
    try {
      const result = await ipcRenderer.invoke('steam-set-rich-presence', { status, details });
      return result.success;
    } catch (error) {
      console.error('Error setting rich presence:', error);
      return false;
    }
  }

  // Screenshots
  async takeScreenshot() {
    if (!this.isInitialized) return false;
    
    try {
      const result = await ipcRenderer.invoke('steam-take-screenshot');
      return result.success;
    } catch (error) {
      console.error('Error taking screenshot:', error);
      return false;
    }
  }

  destroy() {
    if (this.isInitialized) {
      ipcRenderer.invoke('steam-shutdown');
      this.isInitialized = false;
    }
  }
}

export default new SteamClient(); 