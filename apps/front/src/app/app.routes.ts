import { Route } from '@angular/router';
import { adminGuard, authGuard } from './core/auth/auth.guard';

export const appRoutes: Route[] = [
  {
    path: 'login',
    title: 'Connexion · Tekteo',
    loadComponent: () => import('./pages/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'register',
    title: 'Inscription · Tekteo',
    loadComponent: () => import('./pages/register/register.page').then((m) => m.RegisterPage),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/main-layout/main-layout').then((m) => m.MainLayout),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        title: 'Tableau de bord · Tekteo',
        loadComponent: () =>
          import('./pages/dashboard/dashboard.page').then((m) => m.DashboardPage),
      },
      {
        path: 'projects',
        title: 'Projets · Tekteo',
        loadComponent: () =>
          import('./pages/projects/projects-list.page').then((m) => m.ProjectsListPage),
      },
      {
        path: 'projects/new',
        title: 'Nouveau projet · Tekteo',
        loadComponent: () =>
          import('./pages/projects/project-new.page').then((m) => m.ProjectNewPage),
      },
      {
        path: 'projects/:id',
        title: 'Projet · Tekteo',
        loadComponent: () =>
          import('./pages/projects/project-detail.page').then((m) => m.ProjectDetailPage),
      },
      {
        path: 'projects/:id/sections/:sectionId',
        title: 'Section · Tekteo',
        loadComponent: () =>
          import('./pages/sections/section-editor.page').then((m) => m.SectionEditorPage),
      },
      {
        path: 'projects/:id/job-profiles/:profileId',
        title: 'Fiche de poste · Tekteo',
        loadComponent: () =>
          import('./pages/job-profiles/job-profile-detail.page').then(
            (m) => m.JobProfileDetailPage,
          ),
      },
      {
        path: 'veille-ao',
        title: 'Veille AO · Tekteo',
        loadComponent: () =>
          import('./pages/ao-veille/ao-veille.page').then((m) => m.AoVeillePage),
      },
      {
        path: 'veille-ao/analyse',
        title: 'Analyse AO · Tekteo',
        loadComponent: () =>
          import('./pages/ao-analyse/ao-analyse.page').then((m) => m.AoAnalysePage),
      },
      {
        path: 'analyses-ao',
        title: 'Mes analyses · Tekteo',
        loadComponent: () =>
          import('./pages/ao-analyses-list/ao-analyses-list.page').then(
            (m) => m.AoAnalysesListPage,
          ),
      },
      {
        path: 'calendar',
        title: 'Calendrier · Tekteo',
        loadComponent: () =>
          import('./pages/calendar/calendar.page').then((m) => m.CalendarPage),
      },
      {
        path: 'search',
        title: 'Recherche · Tekteo',
        loadComponent: () =>
          import('./pages/search/search.page').then((m) => m.SearchPage),
      },
      {
        path: 'cv-formatter',
        title: 'CV Formatter · Tekteo',
        loadComponent: () =>
          import('./pages/cv-formatter/cv-formatter.page').then((m) => m.CvFormatterPage),
      },
      {
        path: 'cv-formatter/consultants/:id',
        title: 'Consultant · Tekteo',
        loadComponent: () =>
          import('./pages/cv-formatter/consultant-details/consultant-details.page').then(
            (m) => m.ConsultantDetailsPage,
          ),
      },
      {
        path: 'cv-formatter/variants/:id',
        title: 'Variante de CV · Tekteo',
        loadComponent: () =>
          import('./pages/cv-formatter/variant-details/variant-details.page').then(
            (m) => m.VariantDetailsPage,
          ),
      },
      {
        path: 'admin',
        canActivate: [adminGuard],
        children: [
          {
            path: '',
            pathMatch: 'full',
            title: 'Administration · Tekteo',
            loadComponent: () =>
              import('./pages/admin/admin-home.page').then((m) => m.AdminHomePage),
          },
          {
            path: 'users',
            title: 'Utilisateurs · Tekteo',
            loadComponent: () =>
              import('./pages/admin/users/admin-users.page').then((m) => m.AdminUsersPage),
          },
          {
            path: 'prompts',
            title: 'Prompts système · Tekteo',
            loadComponent: () =>
              import('./pages/admin/prompts/admin-prompts.page').then(
                (m) => m.AdminPromptsPage,
              ),
          },
          {
            path: 'section-templates',
            title: 'Modèles de section · Tekteo',
            loadComponent: () =>
              import(
                './pages/admin/section-templates/admin-section-templates.page'
              ).then((m) => m.AdminSectionTemplatesPage),
          },
          {
            path: 'pricing-grids',
            title: 'Grilles de TJM · Tekteo',
            loadComponent: () =>
              import(
                './pages/admin/pricing-grids/admin-pricing-grids.page'
              ).then((m) => m.AdminPricingGridsPage),
          },
        ],
      },
    ],
  },
  {
    path: '**',
    title: 'Page introuvable · Tekteo',
    loadComponent: () => import('./pages/not-found/not-found.page').then((m) => m.NotFoundPage),
  },
];
