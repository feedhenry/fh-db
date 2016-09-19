/**
 * Defines the permissions that are required for the various
 * db actions. This became neccessary because at the moment all actions
 * in databrowser require `write` permissions but we want more fine grained
 * control. In the future this map could also be used for e.g. forms actions.
 */
module.exports = {
  db: {
    create: {
      name: "create",
      requires: "write"
    },
    list: {
      name: "list",
      requires: "read"
    },
    read: {
      name: "read",
      requires: "read"
    },
    delete: {
      name: "delete",
      requires: "write"
    },
    deleteAll: {
      name: "deleteall",
      requires: "write"
    },
    drop: {
      name: "drop",
      requires: "write"
    },
    update: {
      name: "update",
      requires: "write"
    },
    index: {
      name: "index",
      requires: "read"
    },
    export: {
      name: "export",
      requires: "read"
    },
    import: {
      name: "import",
      requires: "write"
    },
    close: {
      name: "close",
      requires: "read"
    }
  }
};