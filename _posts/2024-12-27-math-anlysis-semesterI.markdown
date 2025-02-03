---
layout:     post
title:      "数学分析（上）期末复习汇总"
subtitle:   "定理证明+麦克劳林公式+基本积分表解析几何计算部分公式"
date:       2024-12-27
author:     "CloudingYu"
header-style: picture
mathjax: true
tags:
    - 数学
    - 数学分析
    - 复习
---
## 定理

### 定理 $2.4.2$ （闭区间套定理）

**如果 $\{[a_n,b_n]\}$ 形成一个闭区间套，则存在唯一的实数 $\xi$ 属于所有的闭区间 $[a_n,b_n]$ ，且**

<p style="text-align: center;">$\displaystyle\xi=\lim\limits_{n \to \infty}a_n=\lim\limits_{n \to \infty}b_n$</p>

#### **证明：**

由闭区间套定义及其性质可知

<p style="text-align: center;">$\displaystyle a_1 \le \cdots \le a_{n-1} \le a_n < b_n \le b_{n-1} \le \cdots \le b_1 .$</p>

显然 $\{ a_n\}$ 单调增加而有上界 $b_1$ ，$\{ b_n \}$ 单调减少而有下界 $a_1$ ，$\{ a_n \}$ 和 $\{ b_n \}$ 都收敛.

设 $\lim\limits_{n \to \infty}a_n=\xi$ ，则 

<p style="text-align: center;">$\displaystyle\lim \limits_{n \to \infty}b_n=\lim \limits_{n \to \infty}[(b_n-a_n)+a_n]=\lim \limits_{n \to \infty} (b_n-a_n)+\lim \limits_{n \to \infty}a_n=\xi.$</p>

由于 $\xi$ 是 $\{ a_n\}$ 所构成的数集的上确界，也是$\{b_n\}$ 所构成的数集的下确界，于是有

<p style="text-align: center;">$\displaystyle a_n \le \xi \le b_n, n=1,2,3\cdots,$</p>

即 $\xi$ 属于所有闭区间 $[a_n,b_n]$ .若另有实数 $\xi'$ 属于所有闭区间 $[a_n,b_n]$ ，则也有

<p style="text-align: center;">$\displaystyle a_n \le \xi' \le b_n,n=1,2,3\cdots,$</p>

令 $n \to \infty$ ，由极限的夹逼性得到

<p style="text-align: center;">$\displaystyle\xi'=\lim\limits_{n \to \infty}a_n=\lim\limits_{n \to \infty}b_n=\xi.$</p>

此即说明满足定理结论的实数 $\xi$ 是唯一的。

### 定理 $2.4.5$ （$Bolzano-Weierstrass$定理）

**有界数列必有收敛子列**

#### **证明：**

设数列 $\{x_n\}$ 有界，于是存在实数 $a_1$ , $b_1$ ，成立

<p style="text-align: center;">$\displaystyle a_1\le x_n \le b_1,n=1,2,3,\cdots.$</p>

将区间 $[a_1,b_1]$ 等分为两个小区间 $\displaystyle [a_1,\frac{a_1+b_1}{2}]$ 与 $\displaystyle [\frac{a_1+b_1}{2},b_1]$ ，则其中至少有一个含有数列 $\{x_n\}$ 中的无穷多项，把它记为 $[a_2,b_2]$ .再将闭区间 $[a_2,b_2]$ 等分为两个小区间$\displaystyle [a_2,\frac{a_2+b_2}{2}]$ 与$\displaystyle [\frac{a_2+b_2}{2},b_2]$，同样其中至少有一个含有数列 $\{x_n\}$ 中的无穷多项，把它记为 $[a_3,b_3]$ .这样的步骤可以一直做下去，于是得到一个闭区间套$\{[a_k,b_k]\}$ ，其中每一个闭区间 $[a_k,b_k]$ ，其中每一个闭区间 $[a_k,b_k]$ 中都含有数列 $\{x_n\}$ 中的无穷多项.

根据闭区间套定理，存在实数 $\xi$ ，满足：

<p style="text-align: center;">$\displaystyle\xi=\lim\limits_{k \to \infty}a_k=\lim\limits_{k \to \infty}b_k.$</p>

现在证明数列 $\{x_n\}$ 必有一子列收敛于实数 $\xi$ .首先在 $[a_1,b_1]$ 中选取 $\{x_n\}$ 中某一项，记它为 $x_{n_1}$ .然后因为在 $[a_2,b_2]$ 中含有 $\{x_n\}$ 中无穷多项，可以选取位于 $x_1$ 后的某一项，记它为 $x_{n_2}$ ，$n_2>n_1$ .继续这样下去，在选取 $x_{n_k}\in [a_k,b_k]$ 后，因为在 $[a_{k+1},b_{k+1}]$  中，仍含有$\{x_n\}$ 中的无穷多项，可以选取位于 $x_{n_k}$ 后的某一项，记它为 $x_{n_{k+1}}$ ，$n_{k+1}>n_k$ ，这样就得到了数列 $\{x_n\}$ 的一个子列 $\{x_{n_k}\}$ ，满足：

<p style="text-align: center;">$\displaystyle a_k\le x_{n_k} \le b_k,k=1,2,3,\cdots.$</p>

由$\lim\limits_{k \to \infty}a_k=\lim\limits_{k \to \infty}b_k=\xi$ 利用极限的夹逼性，得到：

<p style="text-align: center;">$\displaystyle\lim\limits_{k \to \infty}x_{n_k}=\xi.$</p>

### 定理 $2.4.7$ （$Cauchy$ 收敛原理）

**数列 $\{x_n\}$ 收敛的充分必要条件是：${x_n}$ 是基本数列.**

#### **证明：**

##### 先证必要性.

设 ${x_n}$ 收敛于 $a$ ，按照定义，$\forall \epsilon>0$ ，$\exists N$ ，$\forall n,m>N$：

<p style="text-align: center;">$\displaystyle |x_n-a|<\frac{\epsilon}{2},|x_m-a|<\frac{\epsilon}{2}.$</p>

于是

<p style="text-align: center;">$\displaystyle |x_n-x_m|\le|x_m-a|+|x_n-a|\le\epsilon.$</p>

##### 再证充分性.

先证明基本数列必定有界.取 $\epsilon_0=1$ ，因为 $\{x_n\}$ 是基本数列，所以 $\exists N_0$ ，$\forall n>N_0$ ：

<p style="text-align: center;">$\displaystyle |x_n-x_{N_0+1}|<1.$</p>

令 $ M=\max \{ |x_1|,|x_2|,\cdots,|x_{N_0}|,|x_{N_0}+1| \} $ ，则对一切 $n$ ，成立

<p style="text-align: center;">$\displaystyle |x_n|\le M.$</p>

由$Bolzano-Weierstrass$定理，在 ${x_n}$ 中必有收敛子列：

<p style="text-align: center;">$\displaystyle \lim\limits_{n \to \infty}x_{n_k}=\xi.$</p>

因为 $\{x_n\}$ 是基本数列，所以 $\forall \epsilon>0$ ，$\exists N$ ，$\forall n,m>N$ ：

<p style="text-align: center;">$\displaystyle |x_n-x_m|<\frac{\epsilon}{2}.$</p>

在上式中取 $x_m=x_{n_k}$ ，其中 $k$ 充分大，满足 $n_k>N$  ，并且令 $k \to \infty$ ，于是得到

<p style="text-align: center;">$\displaystyle |x_n-\xi|\le\frac{\epsilon}{2}<\epsilon.$</p>

此即表明数列 $\{x_n\}$ 收敛.

### 定理 $3.1.5$ （$Heine$定理）

命题

<p style="text-align: center;">$\displaystyle \lim\limits_{x \to x_0} f(x) = A$</p> 

的充分必要条件是：对任意满足条件 

<p style="text-align: center;">$\displaystyle \lim\limits_{n \to \infty} x_n = x_0$</p>

，且 $x_n \neq x_0 (n=1,2,3,\cdots)$ 的数列 $\{x_n\}$ ，相应的函数值数列 $\{f(x_n)\}$ 成立 

<p style="text-align: center;">$\displaystyle \lim_{n \to \infty}f(x_n)=A.$</p>

#### **证明：**

##### 必要性：

由 

<p style="text-align: center;">$\displaystyle \lim\limits_{x \to x_0}f(x)=A$</p> 

可知：

<p style="text-align: center;">$\displaystyle \forall \epsilon >0,\exists \delta >0,\forall x(0<|x-x_0|<\delta):|f(x)-A|<\epsilon$</p>

因为 
<p style="text-align: center;">$\displaystyle \lim\limits_{n \to \infty}x_n=x_0$</p>

 ，且 $x_n \not= x_0(n=1,2,3,\cdots)$，对于上述 $\delta>0$ ， $\exists N$， $\forall n>N$ ：
 
 <p style="text-align: center;">$\displaystyle 0<|x_n-x_0|<\delta.$</p> 

于是当 $n>N$ 时，成立

<p style="text-align: center;">$\displaystyle |f(x_n)-A|<\epsilon.$</p>

即

<p style="text-align: center;">$\displaystyle \lim\limits_{n \to \infty}f(x_n)=A$</p>.

##### 充分性：

用反证法.

按函数极限定义，命题 “ $f(x)$ 在 $x_0$ 点以 $A$ 为极限 “ 可以表述为

<p style="text-align: center;">$\displaystyle \forall \epsilon >0,\exists \delta >0,\forall x (0<|x-x_0|<\delta):|f(x)-A|<\epsilon.$</p>

于是它的否定命题“ $f(x)$ 在 $x_0$ 点不以 $A$ 为极限 “ 可以表述为

<p style="text-align: center;">$\displaystyle \exists \epsilon_0 >0,\forall \delta >0、\exists x (0<|x-x_0|<\delta):|f(x)-A|\ge \epsilon.$</p>

也就是说，存在某个固定正数 $\epsilon_0$ ，不管 $\delta$ 取得多么小，总能在 $O(x_0,\delta) / \{x_0\}$ 中找到一个 $x$ ，使 $f(x)$ 与 $A$ 的差的绝对值不小于 $\epsilon_0$，即 $|f(x)-A|\ge \epsilon$ .

现在取一列 $\{\delta_n\}$ ，取 $\delta_n=\frac{1}{n}(n=1,2,3,\cdots)$ .

对 $\delta_1=1$ ，存在 $x_1(0<|x_1-x0|<\delta_1)$ ，使 $|f(x)-A|\ge\epsilon_0$ .

对 $\delta_2=\frac{1}{2}$ ，存在 $x_2(0<|x_2-x0|<\delta_2)$ ，使 $|f(x)-A|\ge\epsilon_0$ .

$\cdots\cdots$

一般地，对 $\delta_k=\frac{1}{k}$ ，存在 $x_k(0<|x_k-x_0|<\delta_k)$ ，使 $|f(x)-A|\ge\epsilon_0$ .

于是得到数列 $\{x_n\}$ ，满足 $x_n\not=x_0$， $\lim\limits_{n \to \infty}x_n=x_0$ ，但相应的函数值序列 ${f(x_n)}$ 不可能以 $A$为极限.

由此推翻设定，得到 $f(x)$ 在 $x_0$ 点以 $A$ 为极限.

### 定理 $3.4.1$ （有界性定理）

若函数 $f(x)$ 在闭区间 $[a,b]$ 上连续，则它在 $[a,b]$ 上有界.

#### **证明**

用反证法.

若 $f(x)$ 在 $[a,b]$上无界，将 $[a,b]$ 等分为两个小区间 $\displaystyle [a,\frac{a+b}{2}]$ 与 $\displaystyle [\frac{a+b}{2},b]$ ，则 $f(x)$ 至少在其中之一上无界，把它记为 $[a_1,b_1]$ ；再将闭区间 $[a_1,b_1]$ 等分为两个小区间 $\displaystyle [a_1,\frac{a_1+b_1}{2}]$ 与 $\displaystyle [\frac{a_1+b_1}{2},b_1]$ ，同样 $f(x)$ 至少在其中之一上无界，把它记为 $[a_2,b_2]$ $\cdots\cdots$ 这样的步骤一直做下去，便得到一个闭区间套 $\{[a_n,b_n]\}$ ， $f(x)$ 在其中任何一个闭区间 $[a_n,b_n]$ 上都是无界的.

根据闭区间套定理，存在惟一的实数 $\xi$ 属于所有的闭区间 $[a_n,b_n]$ ，并且<p style="text-align: center;">$\displaystyle \xi = \lim\limits_{n_ \to \infty}a_n=\lim\limits_{n\to \infty}b_n.$</p>

因为 $\xi\in[a,b]$ ，而 $f(x)$ 在点 $\xi$ 连续，由函数局部有界性得，存在 $\exists \delta>0$ ，$\exists M>0$， 对于一切 $x\in O(\xi,\delta)\cap[a,b]$ ，成立<p style="text-align: center;">$\displaystyle |f(x)|\le M.$</p>

由于$\lim\limits_{n_ \to \infty}a_n=\lim\limits_{n\to \infty}b_n=\xi$ ，我们又知道对于充分大的 $n$ ，

$$[a_n,b_n]\subset O(\xi,\delta)\cap[a,b]$$

于是得到 $f(x)$ 在这些闭区间 $[a_n,b_n]$ ($n$充分大)上有界的结论，从而产生矛盾.

这说明所作的假设不能成立，即函数 $f(x)$ 在 $[a,b]$ 上必定有界.

### 定理 $3.4.5$ （一致连续的充分必要条件）

设函数 $f(x)$ 再区间 $X$ 上定义，则 $f(x)$ 在 $X$ 上一致连续的充分必要条件是：对任何点列 $\{x'_n\}(x'_n\in X)$ 和 $\{x''_n\}(x''_n\in X)$ ，只要满足 $\lim\limits_{n \to \infty}(x'-x'')=0$ ，就成立 $\lim\limits_{n \to \infty}(f(x')-f(x''))=0$

#### **证明：**

##### 必要性：

函数 $f(x)$ 在 $X$ 上的一致连续性可表述为<p style="text-align: center;">$\displaystyle \forall \epsilon >0,\exists \delta>0,\forall x',x''\in X(|x'-x''|<\delta):|f(x')-f(x'')|<\epsilon.$</p>

对上述的 $\delta>0$ ，由 $\lim\limits_{n \to \infty}(x'_n-x''_n)=0$ ,可知 $\exists N$ ，$\forall n>N$ ：$|x'_n-x''_n|<\delta$ ，从而得到<p style="text-align: center;">$\displaystyle |f(x'_n)-f(x''_n)|<\epsilon.$</p>

这就证明了 <p style="text-align: center;">$\displaystyle \lim\limits_{n \to \infty}(f(x'_n)-f(x''_n))=0$</p>

##### 充分性：

采用反证法.

函数 $f(x)$ 在 $X$ 上的非一致连续性可表述为<p style="text-align: center;">$\displaystyle \exists \epsilon_0>0,\forall \delta >0,\exists x',x''\in X(|x'-x''|<\delta);|f(x')-f(x'')|\ge \epsilon_0.$</p>

取 $\delta_n=\frac{1}{n}(n=1,2,3,\cdots)$ ，于是存在 $x'_n,x''_n\in X$ ，满足<p style="text-align: center;">$\displaystyle |x'_n-x''_n|<\frac{1}{n},|f(x'_n)-f(x''_n)|\ge \epsilon_0.$</p>

显然，$\lim\limits_{n \to \infty}(x'_n-x''_n)=0$ ，但 ${f(x'_n)-f(x''_n)}$ 不可能收敛于 $0$， 这就产生矛盾.

### 定理 $3.4.6$ （$Cantor$定理）

若函数 $f(x)$ 在闭区间 $[a,b]$ 上连续，则它在 $[a,b]$ 上一致连续.

#### **证明：**

采用反证法.

假设 $f(x)$ 在 $[a,b]$ 上非一致连续，则存在 $\epsilon_0>0$，及两列点列 $\{x'_n\}$ 和 $\{x''_n\}$ ， $x'_n,x''_n\in [a,b]$ ，满足<p style="text-align: center;">$\displaystyle |x'_n-x''_n|<\frac{1}{n},且|f(x'_n)-f(x''_n)|\ge \epsilon_0 (n=1,2,3,\cdots).$</p>

因为 $\{x'_n\}$ 有界，由 $Bolzano-Weierstrass$ 定理，存在收敛子列 $\{x'_{n_k}\}$ ：<p style="text-align: center;">$\displaystyle \lim\limits_{n \to \infty}x'_{n_k}=\xi,\xi\in[a,b].$</p>

在点列 $\{x''_n\}$ 中取子列 $\{x''_{n_k}\}$ ，其下标与 $\{x'_{n_k}\}$ 相同，则由 $|x'_{n_k}-x''_{n_k}|<\frac{1}{n_k},k=1,2,3,\cdots.$

又得到<p style="text-align: center;">$\displaystyle \lim\limits_{k \to \infty}x''_{n_k}=\lim\limits_{k \to \infty} [x'_{n_k}+(x''_{n_k}-x'_{n_k})]=\lim\limits_{k \to \infty}x'_{n_k}=\xi.$</p>

由于函数 $f(x)$ 在点 $\xi$ 连续，因而有<p style="text-align: center;">$\displaystyle \lim\limits_{k \to \infty}f(x'_{n_k})=\lim\limits_{k \to \infty}f(x''_{n_k})=f(\xi).$</p>

于是得到：<p style="text-align: center;">$\displaystyle \lim\limits_{k \to \infty}(f(x'_{n_k})-f(x''_{n_k}))=0.$</p>

但这与 <p style="text-align: center;">$\displaystyle |f(x'_n)-f(x''_n)|\ge \epsilon_0$</p> 产生矛盾，从而推翻假设.

### 定理 $4.4.1$ （复合函数求导法则）

设函数 $u=g(x)$ 在 $x=x_0$ 可导，而函数 $y=f(u)$ 在 $u=u_0=g(x_0)$  处可导，则复合函数 $y=f(g(x))$ 在 $x=x_0$ 可导，且有<p style="text-align: center;">$\displaystyle [f(g(x))]'_{x=x_0}=f'(u_0)g'(x_0)=f'(g(x_0))g'(x_0)$</p>

#### **证明：**

因为 $y=f(u)$ 在 $u_0$ 处可导，所以可微. 由可微的定义，对任意一个充分小的 $\Delta u \not= 0$ ，都有<p style="text-align: center;">$\displaystyle f(u_0+\Delta u)-f(u_0)=f'(u_0)\Delta u+\alpha \Delta u$</p>

其中 $\lim\limits_{\Delta u \to 0}\alpha=0$ .因为当 $\Delta u=0$ 时 $\Delta y=0$， 不妨规定当 $\Delta u=0$ 时 $\alpha=0$ ，因此上式对 $\Delta u=0$ 也成立.

设 $\Delta u=g(x_0+\Delta x)-g(x_0)(\Delta x\not=0)$ ，在上式两边同时除以 $\Delta x$ ，则有<p style="text-align: center;">$\displaystyle \frac{f(g(x_0+\Delta x))-f(g(x_0))}{\Delta x}=f'(u_0)\frac{\Delta u}{\Delta x}+\alpha\frac{\Delta u}{\Delta x}$</p>

由函数 $u=g(x)$ 在 $x=x_0$ 可导，即有 $\lim\limits_{\Delta x \to 0}\frac{\Delta u}{\Delta x}=g'(x_0)$，且此式也蕴含了 $\lim\limits_{\Delta x \to 0}\Delta u=0$ .注意到在 $\Delta x \to 0$ 的过程中，或者有 $\Delta u=0$ ，这时有 $\alpha =0$ ；或者有 $\Delta u \not=0$ ，但 $\Delta u$ 趋于 $0$， 因此由 $\lim\limits_{\Delta u \to 0}\alpha=0$， 可知 $\lim\limits_{\Delta x \to 0}\alpha=0$ . 于是令 $\Delta x \to 0$ ，得到<p style="text-align: center;">$\displaystyle \frac{dy}{dx}=\lim\limits_{\Delta x \to 0}\frac{f(g(x_0+\Delta x))-f(g(x_0))}{\Delta x}=f'(u_0)\lim\limits_{\Delta x \to 0}\frac{\Delta u}{\Delta x}+\lim\limits_{\Delta x \to 0}\alpha\lim\limits_{\Delta u}{\Delta x}=f'(u_0)g'(x_0)$</p>

复合函数的求导规则可以写成<p style="text-align: center;">$\displaystyle \frac{dy}{dx}=\frac{dy}{du}\cdot\frac{du}{dx}.$</p>

### 定理 $5.1.3$ （$Lagrange$中值定理）

设函数 $f(x)$ 在闭区间 $[a,b]$ 上连续，在开区间 $(a,b)$ 上可导，则至少存在一点 $\xi \in (a,b)$ ，使得

<p style="text-align: center;">$\displaystyle f'(\xi)=\frac{f(b)-f(a)}{b-a}$</p>

#### **证明：**

作辅助函数

<p style="text-align: center;">$\displaystyle \psi(x)=f(x)-f(a)-\frac{f(b)-f(a)}{b-a}(x-a),x\in[a,b],$</p>

由于函数 $f(x)$ 在闭区间 $[a,b]$ 上连续，在开区间 $(a,b)$ 上可导，因为函数  $\psi (x)$ 也在闭区间 $[a,b]$ 上连续，在开区间 $(a,b)$ 上可导，并且有

<p style="text-align: center;">$\displaystyle \psi(a)=\psi(b)=0,$</p>

于是由 $Rolle$ 定理，至少存在一点 $\xi\in(a,b)$ ，是的 $\psi'(\xi)=0$ . 对 $\psi(x)$ 的表达式求导并令 $\psi'(\xi)=0$ ，整理后便得到

<p style="text-align: center;">$\displaystyle f'(\xi)=\frac{f(b)-f(a)}{b-a}.$</p>

### 定理 $7.2$性质 $6$ （积分第一中值定理）

设 $f(x)$ 和 $g(x)$ 都在 $[a,b]$ 上可积， $g(x)$ 在 $[a,b]$ 上不变号，则存在 $\eta\in[m,M]$ ，使得

<p style="text-align: center;">$\displaystyle \int_{a}^{b}f(x)g(x)dx=\eta\int_{b}^{a}g(x)dx,$</p>

这里 $M$ 和 $m$ 分别表示 $f(x)$ 在 $[a,b]$ 的上确界和下确界.

特别地，若 $f(x)$ 在 $[a,b]$ 上连续，则存在 $\xi\in[a,b]$ ，使得

<p style="text-align: center;">$\displaystyle \int_{a}^{b}f(x)g(x)dx=f(\xi)\int_{a}^{b}g(x)dx.$</p>

#### **证明：**

因为 $g(x)$ 在 $[a,b]$ 上不变号，不妨设

<p style="text-align: center;">$\displaystyle g(x)\ge0,x\in[a,b],$</p>

于是有

<p style="text-align: center;">$\displaystyle mg(x)\le f(x)g(x)\le Mg(x),$</p>

由保序性，得到

<p style="text-align: center;">$\displaystyle m\int_{a}^{b}g(x)dx\le\int_{a}^{b}f(x)g(x)dx\le M\int_{a}^{b}g(x)dx.$</p>

由于 $\int_{a}^{b}f(x)g(x)dx$ 和 $\int_{a}^{b}g(x)dx$ 都是常数，因而必有某个 $\eta \in [m,M]$ ，使得

<p style="text-align: center;">$\displaystyle \int_{a}^{b}f(x)g(x)dx=\eta\int_{a}^{b}g(x)dx.$</p>

若 $f(x)$ 在 $[a,b]$ 上连续，则由闭区间上连续函数的中间值定理，此时必存在某个 $\xi\in[a,b]$ ，使得 $f(\xi)=\eta$ ，因此

<p style="text-align: center;">$\displaystyle \int_{a}^{b}f(x)g(x)dx=f(\xi)\int_{a}^{b}g(x)(b-a)$</p>

### 定理 $7.3.2$ （微积分基本定理）

设 $f(x)$ 在 $[a,b]$ 上连续， $F(x)$ 是 $f(x)$ 在 $[a,b]$ 上的一个原函数，则成立

<p style="text-align: center;">$\displaystyle \int_{a}^{b}f(x)dx=F(b)-F(a)$</p>

#### **证明：**

设 $F(x)$ 是 $f(x)$ 在 $[a,b]$ 上的任一个原函数，而 $\int_{a}^{x}f(t)dt$ 也是 $f(x)$ 在 $[a,b]$ 上的一个原函数，因而两者至多相差一个常数.记

<p style="text-align: center;">$\displaystyle \int_{a}^{x}f(t)dt=F(x)+C$</p>

令 $x=a$ ，即得到 $C=-F(a)$ ，所以

<p style="text-align: center;">$\displaystyle \int_{a}^{x}f(t)dt=F(x)-F(a).$</p>

再令 $x=b$ ，由于定积分中的自变量用什么记号与积分值无关，便可得到

<p style="text-align: center;">$\displaystyle \int_{a}^{b}f(x)dx=\int_{a}^{b}f(t)dt=F(b)-F(a).$</p>

### 定理 $8.2.4$ （积分第二中值定理）

设 $f(x)$ 在 $[a,b]$ 上可积， $g(x)$ 在 $[a,b]$ 上单调，则存在 $\xi\in[a,b]$ ，使得

<p style="text-align: center;">$\displaystyle \int_{a}^{b}f(x)g(x)dx=g(a)\int_{a}^{\xi}f(x)dx+g(b)\int_{\xi}^{b}f(x)dx.$</p>

#### **证明：**

记 $F(x)=\int_{a}^{x}f(t)dt$ ，则 $F(x)$ 在 $[a,b]$ 连续，且 $F(a)=0$. 由于 $f(x)$ 在 $[a,b]$ 上连续，于是 $F(x)$ 是 $f(x)$ 在 $[a,b]$ 上的一个原函数，利用分部积分法，

<p style="text-align: center;">$\displaystyle \int_{a}^{b}f(x)g(x)dx=F(x)g(x)|_a^b-\int_{a}^{b}F(x)g'(x)dx.$</p>

上式右端第一项

<p style="text-align: center;">$\displaystyle F(x)g(x)|_a^b=F(b)g(b)=g(b)\int_a^bf(x)dx,$</p>

而在第二项中，由于 $g(x)$ 单调，因此 $g'(x)$ 保持定号，由积分第一中值定理，存在 $\xi\in [a,b]$ ，使得

<p style="text-align: center;">$\displaystyle \int_{a}^{b}F(x)g'(x)dx=F(\xi)\int_a^bg'(x)dx=[g(b)-g(a)]\int_a^\xi f(x)dx,$</p>

于是

$$

\begin{aligned}\int_a^bf(x)g(x)dx&=g(b)\int_a^b f(x)dx-[g(b)-g(a)]\int_{a}^\xi f(x)dx\\

&=g(a)\int_a^\xi f(x)dx+g(b)\int_\xi^b f(x)dx.

\end{aligned}

$$

### 定理 $8.2.5$ （$Abel$判别法和$Dirichlet$判别法）

若下列两个条件之一满足, 则 <p style="text-align: center;">$\displaystyle\int_{a}^{+\infty} \int_{a}^{+\infty}f(x)g(x)dx$</p> 收敛:

（$1$）($Abel$  判别法) <p style="text-align: center;">$\displaystyle\int_{a}^{+\infty} f(x)dx$</p> 收敛, $g(x)$ 在 $[a, +\infty)$ 上单调有界;

（$2$） ($Dirichlet$ 判别法) <p style="text-align: center;">$\displaystyle F(A) = \int_{a}^{A} f(x)dx$</p> 在 $[a, +\infty)$ 上有界, $g(x)$ 在 $[a, +\infty)$ 上单调且 <p style="text-align: center;">$\displaystyle \lim\limits_{x \to +\infty} g(x) = 0$</p>.

#### **证明：**

（$1$）若 $Abel$ 判别法条件满足，记 $G$ 是 $|g(x)|$ 在 $[a,+\infty)$ 的一个上界，因为 <p style="text-align: center;">$\displaystyle\int_a^{+\infty}f(x)dx$</p> 收敛，由 $Cauchy$ 收敛原理，存在 $A_0\ge a$ ，使得对任意 $A,A'\ge A_0$ ，有

<p style="text-align: center;">$\displaystyle |\int_A^{A'}f(x)dx|<\frac{\epsilon}{2G}$</p>

由积分第二中值定理，

<p style="text-align: center;">$\displaystyle |\int_A^{A'}f(x)g(x)dx|&\le|g(A)|\cdot|\int_A^\xi f(x)dx|+|g(A')|\cdot|\int_\xi^{A'}f(x)dx|$</p>

（$2$）若 $Dirichlet$ 判别法条件满足，记 $M$ 是 $F(A)$ 在 $[a,+\infty)$ 的一个上界.此时对任意  $A,A'\ge a$ 显然有

<p style="text-align: center;">$\displaystyle |\int_A^{A'}f(x)dx|<2M$</p>

因为 <p style="text-align: center;">$\displaystyle \lim\limits_{x \to +\infty}g(x)=0$</p> ，所以存在 $A_0\ge a$ ，当 $x>A_0$ 时 ，有

<p style="text-align: center;">$\displaystyle |g(x)|<\frac{\epsilon}{4M}.$</p>

于是，对任意 $A,A'\ge A_0$ ，

<p style="text-align: center;">$\displaystyle |\int_A^{A'}f(x)g(x)dx|&\le |g(A)|\cdot |\int_A^\xi f(x)dx|+|g(A')|\cdot |\int_\xi^{A'}f(x)dx|$</p>

所以无论哪个判别法条件满足，由 $Cauchy$ 收敛原理，都有 $\int_a ^{+\infty}f(x)g(x)dx$ 收敛的结论.

## 麦克劳林公式

$$

\begin{aligned>

<p style="text-align: center;">$\displaystyle e^x=1+x+\frac{x^2}{2!}+\frac{x^3}{3!}+\cdots+\frac{x^n}{n!}+\cdots$</p>

<p style="text-align: center;">$\displaystyle \sin x=x-\frac{x^3}{3!}+\frac{x^5}{5!}-\cdots+(-1)^n\frac{x^{2n+1}}{(2n+1)!}+\cdots$</p>

<p style="text-align: center;">$\displaystyle \arcsin x=x+\frac{x^3}{3!}+\cdots$</p>

<p style="text-align: center;">$\displaystyle cosx=1-\frac{x^2}{2!}+\frac{x^4}{4!}-\cdots+(-1)^n\frac{x^{2n}}{(2n)!}+\cdots$</p>

<p style="text-align: center;">$\displaystyle (1+x)^\alpha=1+C_\alpha^1x+C_\alpha^2x^2+\cdots+C_\alpha^nx^n+\cdots \alpha\in R$</p>

<p style="text-align: center;">$\displaystyle ln(1+x)=x-\frac{x^2}{2}+\frac{x^3}{3}-\cdots+(-1)^{n-1}\frac{x^n}{n}+\cdots$</p>

<p style="text-align: center;">$\displaystyle \frac{1}{1+x}=1-x+x^2-\cdots+(-1)^{n-1}x^{n-1}+\cdots$</p>

<p style="text-align: center;">$\displaystyle \tan x=x+\frac{x^3}{3}+\cdots$</p>

<p style="text-align: center;">$\displaystyle \arctan x=x-\frac{x^3}{3}+\frac{x^5}{5}-\cdots+(-1)^n\frac{x^{2n+1}}{2n+1}+\cdots$</p>

</begin{aligned>

$$

## 基本积分表

$$

\begin{aligned>

<p style="text-align: center;">$\displaystyle \int\frac{dx}{\sqrt{a^2-x^2}}=\arcsin\frac{x}{a}+C$</p>

<p style="text-align: center;">$\displaystyle \int\frac{dx}{\sqrt{x^2\pm a^2}}=ln\left|x+\sqrt{x^2\pm a^2}\right|+C$</p>

<p style="text-align: center;">$\displaystyle \int\frac{dx}{x^2+a^2}=\frac{1}{a}\arctan\frac{x}{a}+C$</p>

<p style="text-align: center;">$\displaystyle \int\frac{dx}{x^2-a^2}=\frac{1}{2a}ln\left|\frac{x-a}{x+a}\right|+C$</p>

<p style="text-align: center;">$\displaystyle \int\sqrt{a^2-x^2}dx=\frac{1}{2}x\sqrt{a^2-x^2}+\frac{a^2}{2}\arcsin \frac{x}{a}+C$</p>

<p style="text-align: center;">$\displaystyle \int\sqrt{x^2\pm a^2}=\frac{1}{2}\left(x\sqrt{x^2\pm a^2}\pm a^2ln\left|x+\sqrt{x^2\pm a^2}\right|\right)+C$</p>

</begin{aligned>

$$

## 几何计算

### 平面图形面积

$y=f(x),x\in[a,b]$

<p style="text-align: center;">$\displaystyle \int_a^bf(x)dx$</p>

<p>$\begin{cases}x=x(t)\\y=y(t)\\\end{cases}t\in[T_1,T_2]$</p>

<p style="text-align: center;">$\displaystyle \int_{T_1}^{T_2}\left|y(t)x'(t)\right|dt$</p>

$r=r(\theta),\theta\in[\alpha,\beta]$

<p style="text-align: center;">$\displaystyle \frac{1}{2}\int_\alpha^\beta r^2(\theta)d\theta$</p>

### 弧长的微分

$y=f(x),x\in[a,b]$

<p style="text-align: center;">$\displaystyle dl=\sqrt{1+\left[f'(x)\right]^2}dx$</p>

<p>$\begin{cases}x=x(t)\\y=y(t)\\\end{cases}t\in[T_1,T_2]$</p>

<p style="text-align: center;">$\displaystyle dl=\sqrt{\left[x'(t)\right]^2+\left[y'(t)\right]^2}dt$</p>

$r=r(\theta),\theta\in[\alpha,\beta]$

<p style="text-align: center;">$\displaystyle dl=\sqrt{r^2(\theta)+r'^2(\theta)}d\theta$</p>

### 曲线弧长

$y=f(x),x\in[a,b]$

<p style="text-align: center;">$\displaystyle \int_a^b\sqrt{1+\left[f'(x)\right]^2}dx$</p>

<p>$\begin{cases}x=x(t)\\y=y(t)\\\end{cases}t\in[T_1,T_2]$</p>

<p style="text-align: center;">$\displaystyle \int_{T_1}^{T_2}\sqrt{\left[x'(t)\right]^2+\left[y'(t)\right]^2}dt$</p>

$r=r(\theta),\theta\in[\alpha,\beta]$

<p style="text-align: center;">$\displaystyle \int_\alpha^\beta \sqrt{r^2(\theta)+r'^2(\theta)}d\theta$</p>

### 旋转体体积

$y=f(x),x\in[a,b]$

$$\begin{aligned}

<p style="text-align: center;">$\displaystyle V_x&=\pi\int_a^b[f(x)]^2dx$</p>

<p style="text-align: center;">$\displaystyle V_y&=2\pi\int_a^bxf(x)dx$</p>

</begin{aligned}$$

<p style="text-align: center;">$\begin{cases}x=x(t)\\y=y(t)\\\end{cases}t\in[T_1,T_2]$</p>

$$\begin{aligned

<p style="text-align: center;">$\displaystyle V_x&=\pi\int_{T_1}^{T_2}y^2(t)d[x(t)]$</p>

<p style="text-align: center;">$\displaystyle V_y&=2\pi\int_{T_1}^{T_2}x(t)y(t)d[x(t)]$</p>

</begin{aligned}$$

$r=r(\theta),\theta\in[\alpha,\beta]$

<p style="text-align: center;">$\displaystyle \frac{2}{3}\pi\int_\alpha^\beta r^3(\theta)\sin(\theta-\theta_0)d\theta$</p>

### 旋转曲面面积

$y=f(x),x\in[a,b]$

<p style="text-align: center;">$\displaystyle A_x=2\pi\int_a^b|f(x)\sqrt{1+\left[f'(x)\right]^2}dx$</p>

<p>$\begin{cases}x=x(t)\\y=y(t)\\\end{cases}t\in[T_1,T_2]$</p>

<p style="text-align: center;">$\displaystyle A_x=2\pi\int_{T_1}^{T_2}|y(t)|\sqrt{\left[x'(t)\right]^2+\left[y'(t)\right]^2}dt$</p>

$r=r(\theta),\theta\in[\alpha,\beta]$

<p style="text-align: center;">$\displaystyle 2\pi\int_\alpha^\beta r(\theta)\sin(\theta-\theta_0)\sqrt{r^2(\theta)+r'^2(\theta)}d\theta$</p>

### 曲率

$y=f(x),x\in[a,b]$

<p style="text-align: center;">$\displaystyle K=\frac{y''}{(1+y'^2)^\frac{3}{2}}$</p>

<p>$\begin{cases}x=x(t)\\y=y(t)\\\end{cases}t\in[T_1,T_2]$</p>

<p style="text-align: center;">$\displaystyle K=\frac{\left|x'(t)y''(t)-x''(t)y'(t)\right|}{[x'^2(t)+y'^2(t)]^\frac{3}{2}}$</p>

$r=r(\theta),\theta\in[\alpha,\beta]$

<p style="text-align: center;">$\displaystyle K=\frac{\left|r^2+2r'^2-rr''\right|}{(r^2+r'^2)^\frac{3}{2}}$</p>