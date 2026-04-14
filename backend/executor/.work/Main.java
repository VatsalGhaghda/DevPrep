import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        
        int height = 0;
        int total = 0;
        
        for (int i = 1; ; i++) {
            int cubesForLevel = i * (i + 1) / 2;
            
            if (total + cubesForLevel > n) {
                break;
            }
            
            total += cubesForLevel;
            height++;
        }
        
        System.out.println(height);
    }
}