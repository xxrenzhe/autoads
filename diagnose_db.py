#!/usr/bin/env python3

# 数据库连接诊断脚本

import sys
import socket
import ssl
from urllib.parse import urlparse

def test_tcp_connection(host, port, timeout=10):
    """测试TCP连接"""
    print(f"\n🔍 测试 TCP 连接: {host}:{port}")
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        result = sock.connect_ex((host, port))
        sock.close()
        
        if result == 0:
            print("✅ TCP 连接成功")
            return True
        else:
            print(f"❌ TCP 连接失败 (错误码: {result})")
            return False
    except Exception as e:
        print(f"❌ TCP 连接异常: {e}")
        return False

def test_mysql_connection(host, port, username, password, database, timeout=10):
    """测试MySQL连接"""
    print(f"\n🔍 测试 MySQL 连接")
    
    try:
        import pymysql
    except ImportError:
        print("❌ 未安装 pymysql 模块")
        print("安装命令: pip install pymysql")
        return False
    
    try:
        # 创建连接
        conn = pymysql.connect(
            host=host,
            port=port,
            user=username,
            password=password,
            database=database,
            connect_timeout=timeout,
            read_timeout=timeout,
            write_timeout=timeout
        )
        
        print("✅ MySQL 连接成功")
        
        # 执行测试查询
        with conn.cursor() as cursor:
            cursor.execute("SELECT VERSION() as version")
            version = cursor.fetchone()[0]
            print(f"   MySQL 版本: {version}")
            
            # 检查数据库
            cursor.execute("SELECT DATABASE() as db")
            db_name = cursor.fetchone()[0]
            print(f"   当前数据库: {db_name}")
            
            # 检查表
            cursor.execute("SHOW TABLES")
            tables = cursor.fetchall()
            print(f"   表数量: {len(tables)}")
            if tables:
                print("   表列表:")
                for table in tables[:5]:  # 只显示前5个
                    print(f"     - {table[0]}")
                if len(tables) > 5:
                    print(f"     ... 还有 {len(tables)-5} 个表")
        
        conn.close()
        return True
        
    except pymysql.Error as e:
        print(f"❌ MySQL 连接错误: {e}")
        return False
    except Exception as e:
        print(f"❌ MySQL 连接异常: {e}")
        return False

def test_dns_resolution(host):
    """测试DNS解析"""
    print(f"\n🔍 测试 DNS 解析: {host}")
    try:
        import socket
        ip = socket.gethostbyname(host)
        print(f"✅ DNS 解析成功: {host} -> {ip}")
        return ip
    except Exception as e:
        print(f"❌ DNS 解析失败: {e}")
        return None

def main():
    print("=== 数据库连接诊断工具 ===")
    
    # 配置信息
    config = {
        "host": "dbprovider.sg-members-1.clawcloudrun.com",
        "port": 30354,
        "username": "root",
        "password": "jtl85fn8",
        "database": "autoads"
    }
    
    print("配置信息:")
    for key, value in config.items():
        if key == "password":
            print(f"  {key}: {'*' * len(str(value))}")
        else:
            print(f"  {key}: {value}")
    
    # 1. DNS 解析测试
    ip = test_dns_resolution(config["host"])
    if not ip:
        return
    
    # 2. TCP 连接测试
    if not test_tcp_connection(config["host"], config["port"]):
        return
    
    # 3. MySQL 连接测试
    if test_mysql_connection(**config):
        print("\n🎉 所有测试通过！数据库连接正常")
    else:
        print("\n💡 可能的解决方案:")
        print("  1. 检查用户名和密码是否正确")
        print("  2. 检查数据库是否允许远程连接")
        print("  3. 检查防火墙设置")
        print("  4. 检查数据库服务状态")
        print("  5. 尝试使用 SSL 连接")

if __name__ == "__main__":
    main()