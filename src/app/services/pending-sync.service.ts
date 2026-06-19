import { Injectable } from '@angular/core';
import { HttpBackend, HttpClient, HttpHeaders } from '@angular/common/http';
import { fromEvent } from 'rxjs';

interface PendingRequest {
  id: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  body?: unknown;
  createdAt: string;
}

@Injectable({
  providedIn: 'root',
})
export class PendingSyncService {
  private readonly storageKey = 'alorack-pending-sync';
  private isFlushing = false;
  private rawHttp: HttpClient;

  constructor(httpBackend: HttpBackend) {
    this.rawHttp = new HttpClient(httpBackend);
    fromEvent(window, 'online').subscribe(() => this.flush());

    if (navigator.onLine) {
      setTimeout(() => this.flush(), 1000);
    }
  }

  enqueue(method: PendingRequest['method'], url: string, body?: unknown): void {
    const pending = this.getPending();
    pending.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      method,
      url,
      body,
      createdAt: new Date().toISOString(),
    });
    this.savePending(pending);
  }

  pendingCount(): number {
    return this.getPending().length;
  }

  async flush(): Promise<void> {
    if (this.isFlushing || !navigator.onLine) {
      return;
    }

    this.isFlushing = true;
    const pending = this.getPending();
    const remaining: PendingRequest[] = [];
    const token = localStorage.getItem('access_token');
    const headers = new HttpHeaders({
      'X-Skip-Pending-Queue': 'true',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    });

    for (const request of pending) {
      try {
        if (request.method === 'POST') {
          await this.rawHttp.post(request.url, request.body, { headers }).toPromise();
        } else if (request.method === 'PUT') {
          await this.rawHttp.put(request.url, request.body, { headers }).toPromise();
        } else if (request.method === 'PATCH') {
          await this.rawHttp.patch(request.url, request.body, { headers }).toPromise();
        } else {
          await this.rawHttp.delete(request.url, { headers }).toPromise();
        }
      } catch {
        remaining.push(request);
      }
    }

    this.savePending(remaining);
    this.isFlushing = false;
  }

  private getPending(): PendingRequest[] {
    try {
      return JSON.parse(localStorage.getItem(this.storageKey) || '[]') || [];
    } catch {
      return [];
    }
  }

  private savePending(pending: PendingRequest[]): void {
    localStorage.setItem(this.storageKey, JSON.stringify(pending));
  }
}
