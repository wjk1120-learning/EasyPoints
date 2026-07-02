USE easy_points;

SET NAMES utf8mb4;

INSERT INTO departments (id, name, parent_id) VALUES
  (1, '人事部', NULL),
  (2, '研发部', NULL);

INSERT INTO employees (id, wecom_user_id, name, department_id, points_balance, status) VALUES
  (1, 'zhangsan', '张三', 2, 1200, 'active'),
  (2, 'lisi', '李四', 1, 800, 'active');

INSERT INTO admins (id, username, password_hash, name, role) VALUES
  (1, 'admin', 'scrypt$16384$8$1$UZDAKJ4M70EJyYOb6wAZog==$CO4jqLnQ4y0qKjLTao8LdUlZo8rtqIvmkbqv7bGveJg=', '系统管理员', 'super_admin'),
  (2, 'rd_manager', 'scrypt$16384$8$1$UZDAKJ4M70EJyYOb6wAZog==$CO4jqLnQ4y0qKjLTao8LdUlZo8rtqIvmkbqv7bGveJg=', '研发部门管理员', 'department_admin');

INSERT INTO admin_departments (admin_id, department_id) VALUES
  (1, 1),
  (1, 2),
  (2, 2);

INSERT INTO gifts (id, name, points_cost, stock, status, limit_per_user) VALUES
  (1, '京东购物卡 100 元', 1000, 20, 'active', 2),
  (2, '带薪休假半天', 1500, 10, 'active', 1);
