import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { authGuard, publicOnlyGuard, startupGuard } from './guards/startup.guard';

const routes: Routes = [
  {
    path: 'onboarding',
    canActivate: [publicOnlyGuard],
    loadChildren: () => import('./onboarding/onboarding.module').then(m => m.OnboardingModule)
  },
  {
    path: 'login',
    canActivate: [publicOnlyGuard],
    loadChildren: () => import('./login/login.module').then(m => m.LoginPageModule)
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadChildren: () => import('./home/home.module').then( m => m.HomePageModule)
  },
  {
    path: 'home',
    canActivate: [authGuard],
    loadChildren: () => import('./home/home.module').then( m => m.HomePageModule)
  },
  {
    path: 'inventory',
    canActivate: [authGuard],
    loadChildren: () => import('./inventory/inventory.module').then(m => m.InventoryPageModule)
  },
  {
    path: 'inventory-detail/:sku',
    canActivate: [authGuard],
    loadChildren: () => import('./inventory-detail/inventory-detail.module').then(m => m.InventoryDetailPageModule)
  },
  {
    path: 'inventory-edit/:sku',
    canActivate: [authGuard],
    loadChildren: () => import('./inventory-edit/inventory-edit.module').then(m => m.InventoryEditPageModule)
  },
  {
    path: 'history',
    canActivate: [authGuard],
    loadChildren: () => import('./history/history.module').then(m => m.HistoryPageModule)
  },
  {
    path: 'profile',
    canActivate: [authGuard],
    loadChildren: () => import('./profile/profile.module').then(m => m.ProfilePageModule)
  },
  {
    path: 'edit-profile',
    canActivate: [authGuard],
    loadChildren: () => import('./edit-profile/edit-profile.module').then(m => m.EditProfilePageModule)
  },
  {
    path: 'notifications',
    canActivate: [authGuard],
    loadChildren: () => import('./notifications/notifications.module').then(m => m.NotificationsPageModule)
  },
  {
    path: 'help-support',
    canActivate: [authGuard],
    loadChildren: () => import('./help-support/help-support.module').then(m => m.HelpSupportPageModule)
  },
  {
    path: 'goods-in',
    canActivate: [authGuard],
    loadChildren: () => import('./goods-in/goods-in.module').then(m => m.GoodsInPageModule)
  },
  {
    path: 'goods-out',
    canActivate: [authGuard],
    loadChildren: () => import('./goods-out/goods-out.module').then(m => m.GoodsOutPageModule)
  },
  {
    path: 'stock-mutation',
    canActivate: [authGuard],
    loadChildren: () => import('./stock-mutation/stock-mutation.module').then(m => m.StockMutationPageModule)
  },
  {
    path: 'about-app',
    canActivate: [authGuard],
    loadChildren: () => import('./about-app/about-app.module').then(m => m.AboutAppPageModule)
  },
  {
    path: '',
    canActivate: [startupGuard],
    children: [],
    pathMatch: 'full'
  },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
