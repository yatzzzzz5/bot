import { io, Socket } from 'socket.io-client';

export interface LivePrice {
  symbol: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  volume24h: number;
  timestamp: Date;
}

export interface RealTimeStatus {
  isRunning: boolean;
  priceServiceRunning: boolean;
  lastUpdate: Date;
}

class RealTimeService {
  private socket: Socket | null = null;
  private isConnected: boolean = false;

  constructor() {
    this.initializeSocket();
  }

  private initializeSocket() {
    try {
      this.socket = io('http://localhost:5000');
      
      this.socket.on('connect', () => {
        console.log('🔌 Connected to real-time service');
        this.isConnected = true;
      });

      this.socket.on('disconnect', () => {
        console.log('🔌 Disconnected from real-time service');
        this.isConnected = false;
      });

      this.socket.on('price_update', (data: LivePrice) => {
        console.log('📊 Price update:', data);
        // You can emit custom events here for components to listen to
        window.dispatchEvent(new CustomEvent('price_update', { detail: data }));
      });

      this.socket.on('position_update', (data: any) => {
        console.log('📈 Position update:', data);
        window.dispatchEvent(new CustomEvent('position_update', { detail: data }));
      });

      this.socket.on('risk_alert', (data: any) => {
        console.log('⚠️ Risk alert:', data);
        window.dispatchEvent(new CustomEvent('risk_alert', { detail: data }));
      });

    } catch (error) {
      console.error('Failed to initialize real-time service:', error);
    }
  }

  private async authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const token = localStorage.getItem('authToken');
    const headers = new Headers(options.headers);
    
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    
    headers.set('Content-Type', 'application/json');
    
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include'
    });
    
    if (response.status === 401) {
      localStorage.removeItem('authToken');
    }
    
    return response;
  }

  async getRealTimeStatus(): Promise<RealTimeStatus> {
    try {
      const response = await this.authenticatedFetch('http://localhost:5000/api/real-time/status');
      if (!response.ok) throw new Error('Failed to fetch real-time status');
      return response.json();
    } catch (error) {
      console.error('Error fetching real-time status:', error);
      return {
        isRunning: false,
        priceServiceRunning: false,
        lastUpdate: new Date()
      };
    }
  }

  async getLivePrices(): Promise<LivePrice[]> {
    try {
      const response = await this.authenticatedFetch('http://localhost:5000/api/real-time/prices');
      if (!response.ok) throw new Error('Failed to fetch live prices');
      const data = await response.json();
      return data.prices || [];
    } catch (error) {
      console.error('Error fetching live prices:', error);
      return [];
    }
  }

  subscribeToPriceUpdates(callback: (price: LivePrice) => void) {
    const handler = (event: CustomEvent) => {
      callback(event.detail);
    };
    
    window.addEventListener('price_update', handler as EventListener);
    
    // Return unsubscribe function
    return () => {
      window.removeEventListener('price_update', handler as EventListener);
    };
  }

  subscribeToPositionUpdates(callback: (position: any) => void) {
    const handler = (event: CustomEvent) => {
      callback(event.detail);
    };
    
    window.addEventListener('position_update', handler as EventListener);
    
    return () => {
      window.removeEventListener('position_update', handler as EventListener);
    };
  }

  subscribeToRiskAlerts(callback: (alert: any) => void) {
    const handler = (event: CustomEvent) => {
      callback(event.detail);
    };
    
    window.addEventListener('risk_alert', handler as EventListener);
    
    return () => {
      window.removeEventListener('risk_alert', handler as EventListener);
    };
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected = false;
  }

  isServiceConnected(): boolean {
    return this.isConnected;
  }
}

export const realTimeService = new RealTimeService();
