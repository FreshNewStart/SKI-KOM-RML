export const permissions = {
  Admin: {
    dashboard: true,

    projects: {
      view: true,
      create: true,
      edit: true,
      delete: true,
    },

    stages: {
      view: true,
      create: true,
      edit: true,
      delete: true,
    },

    activities: {
      view: true,
      create: true,
      edit: true,
      delete: true,
      updateProgress: true,
    },

    reports: {
      view: true,
      create: true,
    },

    users: {
      view: true,
      create: true,
      edit: true,
      delete: true,
    },

    settings: {
      view: true,
      edit: true,
    },
  },

  "Project Manager": {
    dashboard: true,

    projects: {
      view: true,
      create: true,
      edit: true,
      delete: false,
    },

    stages: {
      view: true,
      create: true,
      edit: true,
      delete: true,
    },

    activities: {
      view: true,
      create: true,
      edit: true,
      delete: true,
      updateProgress: true,
    },

    reports: {
      view: true,
      create: true,
    },

    users: {
      view: false,
      create: false,
      edit: false,
      delete: false,
    },

    settings: {
      view: false,
      edit: false,
    },
  },

  "Project Officer": {
    dashboard: true,

    projects: {
      view: true,
      create: false,
      edit: false,
      delete: false,
    },

    stages: {
      view: true,
      create: true,
      edit: true,
      delete: false,
    },

    activities: {
      view: true,
      create: true,
      edit: true,
      delete: false,
      updateProgress: true,
    },

    reports: {
      view: true,
      create: true,
    },

    users: {
      view: false,
      create: false,
      edit: false,
      delete: false,
    },

    settings: {
      view: false,
      edit: false,
    },
  },

  "Site Supervisor": {
    dashboard: true,

    projects: {
      view: true,
      create: false,
      edit: false,
      delete: false,
    },

    stages: {
      view: true,
      create: false,
      edit: false,
      delete: false,
    },

    activities: {
      view: true,
      create: true,
      edit: true,
      delete: false,
      updateProgress: true,
    },

    reports: {
      view: true,
      create: true,
    },

    users: {
      view: false,
      create: false,
      edit: false,
      delete: false,
    },

    settings: {
      view: false,
      edit: false,
    },
  },

  Viewer: {
    dashboard: true,

    projects: {
      view: true,
      create: false,
      edit: false,
      delete: false,
    },

    stages: {
      view: true,
      create: false,
      edit: false,
      delete: false,
    },

    activities: {
      view: true,
      create: false,
      edit: false,
      delete: false,
      updateProgress: false,
    },

    reports: {
      view: true,
      create: false,
    },

    users: {
      view: false,
      create: false,
      edit: false,
      delete: false,
    },

    settings: {
      view: false,
      edit: false,
    },
  },
};


export function hasPermission(role, section, action) {
  return permissions?.[role]?.[section]?.[action] === true;
}
