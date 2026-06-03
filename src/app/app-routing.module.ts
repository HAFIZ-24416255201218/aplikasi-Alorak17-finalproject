import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: 'onboarding',
    loadChildren: () => import('./onboarding/onboarding.module').then(m => m.OnboardingModule)
  },
  {
    path: 'login',
    loadChildren: () => import('./login/login.module').then(m => m.LoginPageModule)
  },
  {
    path: 'register',
    loadChildren: () => import('./register/register.module').then(m => m.RegisterPageModule)
  },
  {
    path: 'dashboard',
    loadChildren: () => import('./home/home.module').then( m => m.HomePageModule)
  },
  {
    path: 'home',
    loadChildren: () => import('./home/home.module').then( m => m.HomePageModule)
  },
  {
    path: 'inventory',
    loadChildren: () => import('./inventory/inventory.module').then(m => m.InventoryPageModule)
  },
  {
    path: 'inventory-detail/:sku',
    loadChildren: () => import('./inventory-detail/inventory-detail.module').then(m => m.InventoryDetailPageModule)
  },
  {
    path: 'inventory-edit/:sku',
    loadChildren: () => import('./inventory-edit/inventory-edit.module').then(m => m.InventoryEditPageModule)
  },
  {
    path: 'history',
    loadChildren: () => import('./history/history.module').then(m => m.HistoryPageModule)
  },
  {
    path: 'profile',
    loadChildren: () => import('./profile/profile.module').then(m => m.ProfilePageModule)
  },
  {
    path: 'edit-profile',
    loadChildren: () => import('./edit-profile/edit-profile.module').then(m => m.EditProfilePageModule)
  },
  {
    path: 'notifications',
    loadChildren: () => import('./notifications/notifications.module').then(m => m.NotificationsPageModule)
  },
  {
    path: 'help-support',
    loadChildren: () => import('./help-support/help-support.module').then(m => m.HelpSupportPageModule)
  },
  {
    path: 'goods-in',
    loadChildren: () => import('./goods-in/goods-in.module').then(m => m.GoodsInPageModule)
  },
  {
    path: 'goods-out',
    loadChildren: () => import('./goods-out/goods-out.module').then(m => m.GoodsOutPageModule)
  },
  {
    path: 'stock-mutation',
    loadChildren: () => import('./stock-mutation/stock-mutation.module').then(m => m.StockMutationPageModule)
  },
  {
    path: 'about-app',
    loadChildren: () => import('./about-app/about-app.module').then(m => m.AboutAppPageModule)
  },
  {
    path: '',
    redirectTo: 'onboarding',
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
