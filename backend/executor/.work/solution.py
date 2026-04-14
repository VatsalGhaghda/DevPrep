# Write your solution here
import sys

def solve():
    data = list(map(int, sys.stdin.read().strip().split()))
    
    n = data[0]
    
    # Last n elements are the array
    a = data[-n:]
    
    # The remaining middle value is t
    t = data[1]
    if len(data) > n + 1:
        t = data[1] if len(data) == n + 2 else data[-n-1]
    
    left = 0
    current_sum = 0
    max_count = 0
    
    for right in range(n):
        current_sum += a[right]
        
        while current_sum > t:
            current_sum -= a[left]
            left += 1
        
        max_count = max(max_count, right - left + 1)
    
    print(max_count)

solve()