// Browser-compatible Steam client with Electron fallback
class SteamClient {
  constructor() {
    this.steamworks = null;
    this.isInitialized = false;
    this.appId = null;
    this.isElectron = typeof window !== 'undefined' && window.require;
  }

  async initialize(appId) {
    try {
      this.appId = appId;
      
      if (this.isElectron) {
        // Electron environment
        const { ipcRenderer } = window.require('electron');
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
      } else {
        // Browser environment - simulate Steam API
        console.log('[BROWSER DEV] Steam API simulation enabled');
        this.isInitialized = true;
        
        // Simulate user info
        const userInfo = {
          steamId: '76561198000000000',
          personaName: 'WebDeveloper',
          profileUrl: 'https://steamcommunity.com/profiles/76561198000000000'
        };
        console.log('[BROWSER DEV] Steam user:', userInfo);
        
        return true;
      }
    } catch (error) {
      console.error('Steam initialization error:', error);
      return false;
    }
  }

  async getUserInfo() {
    if (!this.isInitialized) return null;
    
    if (this.isElectron) {
      try {
        const { ipcRenderer } = window.require('electron');
        return await ipcRenderer.invoke('steam-get-user-info');
      } catch (error) {
        console.error('Error getting user info:', error);
        return null;
      }
    } else {
      return {
        steamId: '76561198000000000',
        personaName: 'WebDeveloper',
        profileUrl: 'https://steamcommunity.com/profiles/76561198000000000'
      };
    }
  }

  async unlockAchievement(achievementId) {
    if (!this.isInitialized) return false;
    
    if (this.isElectron) {
      try {
        const { ipcRenderer } = window.require('electron');
        const result = await ipcRenderer.invoke('steam-unlock-achievement', achievementId);
        return result.success;
      } catch (error) {
        console.error('Error unlocking achievement:', error);
        return false;
      }
    } else {
      console.log(`[BROWSER DEV] Achievement unlocked: ${achievementId}`);
      return true;
    }
  }

  async setStat(statName, value) {
    if (!this.isInitialized) return false;
    
    if (this.isElectron) {
      try {
        const { ipcRenderer } = window.require('electron');
        const result = await ipcRenderer.invoke('steam-set-stat', { statName, value });
        return result.success;
      } catch (error) {
        console.error('Error setting stat:', error);
        return false;
      }
    } else {
      console.log(`[BROWSER DEV] Stat set: ${statName} = ${value}`);
      return true;
    }
  }

  async getLeaderboards() {
    if (!this.isInitialized) return [];
    
    if (this.isElectron) {
      try {
        const { ipcRenderer } = window.require('electron');
        return await ipcRenderer.invoke('steam-get-leaderboards');
      } catch (error) {
        console.error('Error getting leaderboards:', error);
        return [];
      }
    } else {
      console.log('[BROWSER DEV] Leaderboards requested');
      return [
        { name: 'Global Wins', entries: [{ player: 'WebDeveloper', score: 100 }] }
      ];
    }
  }

  async submitScore(leaderboardName, score) {
    if (!this.isInitialized) return false;
    
    if (this.isElectron) {
      try {
        const { ipcRenderer } = window.require('electron');
        const result = await ipcRenderer.invoke('steam-submit-score', { leaderboardName, score });
        return result.success;
      } catch (error) {
        console.error('Error submitting score:', error);
        return false;
      }
    } else {
      console.log(`[BROWSER DEV] Score submitted: ${leaderboardName} = ${score}`);
      return true;
    }
  }

  // Multiplayer lobbies
  async createLobby(maxPlayers = 4) {
    if (!this.isInitialized) return null;
    
    if (this.isElectron) {
      try {
        const { ipcRenderer } = window.require('electron');
        return await ipcRenderer.invoke('steam-create-lobby', maxPlayers);
      } catch (error) {
        console.error('Error creating lobby:', error);
        return null;
      }
    } else {
      const fakeLobbyId = 'browser_lobby_' + Date.now();
      console.log(`[BROWSER DEV] Lobby created: ${fakeLobbyId}`);
      return { lobbyId: fakeLobbyId, maxPlayers };
    }
  }

  async joinLobby(lobbyId) {
    if (!this.isInitialized) return false;
    
    if (this.isElectron) {
      try {
        const { ipcRenderer } = window.require('electron');
        const result = await ipcRenderer.invoke('steam-join-lobby', lobbyId);
        return result.success;
      } catch (error) {
        console.error('Error joining lobby:', error);
        return false;
      }
    } else {
      console.log(`[BROWSER DEV] Joined lobby: ${lobbyId}`);
      return true;
    }
  }

  async findLobbies() {
    if (!this.isInitialized) return [];
    
    if (this.isElectron) {
      try {
        const { ipcRenderer } = window.require('electron');
        return await ipcRenderer.invoke('steam-find-lobbies');
      } catch (error) {
        console.error('Error finding lobbies:', error);
        return [];
      }
    } else {
      console.log('[BROWSER DEV] Finding lobbies...');
      return [
        { lobbyId: 'browser_lobby_1', players: 2, maxPlayers: 4 },
        { lobbyId: 'browser_lobby_2', players: 1, maxPlayers: 4 }
      ];
    }
  }

  // Rich presence
  async setRichPresence(status, details = '') {
    if (!this.isInitialized) return false;
    
    if (this.isElectron) {
      try {
        const { ipcRenderer } = window.require('electron');
        const result = await ipcRenderer.invoke('steam-set-rich-presence', { status, details });
        return result.success;
      } catch (error) {
        console.error('Error setting rich presence:', error);
        return false;
      }
    } else {
      console.log(`[BROWSER DEV] Rich presence: ${status} - ${details}`);
      return true;
    }
  }

  // Screenshots
  async takeScreenshot() {
    if (!this.isInitialized) return false;
    
    if (this.isElectron) {
      try {
        const { ipcRenderer } = window.require('electron');
        const result = await ipcRenderer.invoke('steam-take-screenshot');
        return result.success;
      } catch (error) {
        console.error('Error taking screenshot:', error);
        return false;
      }
    } else {
      console.log('[BROWSER DEV] Screenshot taken');
      return true;
    }
  }

  destroy() {
    if (this.isInitialized && this.isElectron) {
      const { ipcRenderer } = window.require('electron');
      ipcRenderer.invoke('steam-shutdown');
    }
    this.isInitialized = false;
  }
}

export default new SteamClient(); 